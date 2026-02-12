const express = require('express');
const { query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { auth } = require('../middleware/auth');
const emailService = require('../utils/emailService');

const router = express.Router();

// @route   GET /api/reports/overview
// @desc    Get financial overview report
// @access  Private
router.get('/overview', [
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year', 'custom'])
    .withMessage('Invalid period'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { period = 'month', startDate, endDate } = req.query;

    // Calculate date range
    const now = new Date();
    let dateRange = {};

    if (period === 'custom' && startDate && endDate) {
      dateRange = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      let start;
      switch (period) {
        case 'week':
          start = new Date(now);
          start.setDate(now.getDate() - 7);
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      dateRange = { $gte: start, $lte: now };
    }

    // Get financial summary
    const [incomeExpenseSummary, categoryBreakdown, dailyTrends, topTransactions] = await Promise.all([
      // Income vs Expense Summary
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            date: dateRange,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            average: { $avg: '$amount' }
          }
        }
      ]),

      // Category Breakdown
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            date: dateRange,
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: {
              category: '$category',
              type: '$type'
            },
            categoryName: { $first: '$categoryInfo.name' },
            categoryColor: { $first: '$categoryInfo.color' },
            categoryIcon: { $first: '$categoryInfo.icon' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]),

      // Daily Trends
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            date: dateRange,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              type: '$type'
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            income: {
              $sum: {
                $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
              }
            },
            expense: {
              $sum: {
                $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
              }
            },
            transactions: { $sum: '$count' }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]),

      // Top Transactions
      Transaction.find({
        user: req.user._id,
        date: dateRange,
        status: 'completed'
      })
        .populate('category', 'name color icon')
        .sort({ amount: -1 })
        .limit(10)
        .select('title amount type date category paymentMethod')
    ]);

    // Format income/expense summary
    const summary = {
      income: 0,
      expense: 0,
      netIncome: 0,
      transactionCount: 0
    };

    incomeExpenseSummary.forEach(item => {
      summary[item._id] = item.total;
      summary.transactionCount += item.count;
    });
    summary.netIncome = summary.income - summary.expense;

    // Get budget performance
    const activeBudgets = await Budget.find({
      user: req.user._id,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    const budgetSummary = {
      totalBudgets: activeBudgets.length,
      totalBudgetAmount: activeBudgets.reduce((sum, b) => sum + b.totalBudget, 0),
      totalSpent: activeBudgets.reduce((sum, b) => sum + b.totalSpent, 0),
      budgetsOverLimit: activeBudgets.filter(b => b.utilizationPercentage > 100).length
    };

    res.json({
      message: 'Financial overview retrieved successfully',
      period,
      dateRange: {
        start: Object.values(dateRange)[0],
        end: Object.values(dateRange)[1] || now
      },
      summary,
      budgetSummary,
      categoryBreakdown,
      dailyTrends,
      topTransactions
    });

  } catch (error) {
    console.error('Get overview report error:', error);
    res.status(500).json({
      message: 'Server error generating overview report'
    });
  }
});

// @route   GET /api/reports/spending-analysis
// @desc    Get detailed spending analysis
// @access  Private
router.get('/spending-analysis', [
  query('period')
    .optional()
    .isIn(['month', 'quarter', 'year'])
    .withMessage('Invalid period'),
  query('compareWith')
    .optional()
    .isIn(['previous', 'year-ago'])
    .withMessage('Invalid comparison period')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { period = 'month', compareWith } = req.query;

    const now = new Date();
    let currentStart, currentEnd, compareStart, compareEnd;

    // Calculate current period
    switch (period) {
      case 'month':
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        if (compareWith === 'previous') {
          compareStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          compareEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (compareWith === 'year-ago') {
          compareStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          compareEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);
        }
        break;
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        currentEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        if (compareWith === 'previous') {
          const prevQuarter = currentQuarter - 1;
          if (prevQuarter < 0) {
            compareStart = new Date(now.getFullYear() - 1, 9, 1);
            compareEnd = new Date(now.getFullYear() - 1, 12, 0);
          } else {
            compareStart = new Date(now.getFullYear(), prevQuarter * 3, 1);
            compareEnd = new Date(now.getFullYear(), (prevQuarter + 1) * 3, 0);
          }
        } else if (compareWith === 'year-ago') {
          compareStart = new Date(now.getFullYear() - 1, currentQuarter * 3, 1);
          compareEnd = new Date(now.getFullYear() - 1, (currentQuarter + 1) * 3, 0);
        }
        break;
      case 'year':
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31);
        if (compareWith) {
          compareStart = new Date(now.getFullYear() - 1, 0, 1);
          compareEnd = new Date(now.getFullYear() - 1, 11, 31);
        }
        break;
    }

    const analysisPromises = [
      // Current period analysis
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'expense',
            date: { $gte: currentStart, $lte: currentEnd },
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: '$category',
            categoryName: { $first: '$categoryInfo.name' },
            categoryColor: { $first: '$categoryInfo.color' },
            categoryIcon: { $first: '$categoryInfo.icon' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            average: { $avg: '$amount' },
            max: { $max: '$amount' },
            min: { $min: '$amount' }
          }
        },
        {
          $sort: { total: -1 }
        }
      ])
    ];

    // Add comparison period analysis if requested
    if (compareWith && compareStart && compareEnd) {
      analysisPromises.push(
        Transaction.aggregate([
          {
            $match: {
              user: req.user._id,
              type: 'expense',
              date: { $gte: compareStart, $lte: compareEnd },
              status: 'completed'
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'categoryInfo'
            }
          },
          {
            $unwind: '$categoryInfo'
          },
          {
            $group: {
              _id: '$category',
              categoryName: { $first: '$categoryInfo.name' },
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ])
      );
    }

    const results = await Promise.all(analysisPromises);
    const currentAnalysis = results[0];
    const compareAnalysis = results[1] || [];

    // Calculate totals and insights
    const currentTotal = currentAnalysis.reduce((sum, cat) => sum + cat.total, 0);
    const compareTotal = compareAnalysis.reduce((sum, cat) => sum + cat.total, 0);

    const insights = {
      totalSpending: currentTotal,
      categoryCount: currentAnalysis.length,
      averagePerCategory: currentTotal / (currentAnalysis.length || 1),
      topCategory: currentAnalysis[0] || null,
      comparison: null
    };

    if (compareWith && compareTotal > 0) {
      const change = ((currentTotal - compareTotal) / compareTotal) * 100;
      insights.comparison = {
        previousTotal: compareTotal,
        change: change,
        changeAmount: currentTotal - compareTotal,
        trend: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable'
      };

      // Category-wise comparison
      const categoryComparison = currentAnalysis.map(current => {
        const previous = compareAnalysis.find(comp => 
          comp._id.toString() === current._id.toString()
        );
        
        if (previous) {
          const categoryChange = ((current.total - previous.total) / previous.total) * 100;
          return {
            ...current,
            previousTotal: previous.total,
            change: categoryChange,
            changeAmount: current.total - previous.total
          };
        }
        
        return {
          ...current,
          previousTotal: 0,
          change: 100,
          changeAmount: current.total,
          isNew: true
        };
      });

      insights.categoryComparison = categoryComparison;
    }

    // Monthly breakdown for the current period
    const monthlyBreakdown = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: currentStart, $lte: currentEnd },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      message: 'Spending analysis retrieved successfully',
      period,
      dateRange: {
        current: { start: currentStart, end: currentEnd },
        compare: compareWith ? { start: compareStart, end: compareEnd } : null
      },
      insights,
      currentAnalysis,
      monthlyBreakdown
    });

  } catch (error) {
    console.error('Get spending analysis error:', error);
    res.status(500).json({
      message: 'Server error generating spending analysis'
    });
  }
});

// @route   GET /api/reports/budget-performance
// @desc    Get budget performance report
// @access  Private
router.get('/budget-performance', auth, async (req, res) => {
  try {
    const now = new Date();

    // Get all budgets (active and completed in the last year)
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    const budgets = await Budget.find({
      user: req.user._id,
      startDate: { $gte: yearAgo }
    }).populate('categories.category', 'name color icon');

    const activeBudgets = budgets.filter(b => b.isActive);
    const completedBudgets = budgets.filter(b => !b.isActive && b.endDate < now);

    // Calculate performance metrics
    const performance = {
      overview: {
        totalBudgets: budgets.length,
        activeBudgets: activeBudgets.length,
        completedBudgets: completedBudgets.length,
        totalBudgetAmount: budgets.reduce((sum, b) => sum + b.totalBudget, 0),
        totalSpentAmount: budgets.reduce((sum, b) => sum + b.totalSpent, 0)
      },
      activePerformance: activeBudgets.map(budget => ({
        id: budget._id,
        name: budget.name,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        totalBudget: budget.totalBudget,
        totalSpent: budget.totalSpent,
        utilizationPercentage: budget.utilizationPercentage,
        remainingBudget: budget.remainingBudget,
        daysRemaining: budget.daysRemaining,
        status: budget.status,
        categories: budget.categories.map(cat => ({
          category: cat.category,
          budgetAmount: cat.budgetAmount,
          spentAmount: cat.spentAmount,
          utilization: cat.budgetAmount > 0 ? (cat.spentAmount / cat.budgetAmount) * 100 : 0
        }))
      })),
      completedPerformance: completedBudgets.map(budget => ({
        id: budget._id,
        name: budget.name,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        totalBudget: budget.totalBudget,
        totalSpent: budget.totalSpent,
        utilizationPercentage: budget.utilizationPercentage,
        success: budget.utilizationPercentage <= 100
      }))
    };

    // Calculate success rate
    if (completedBudgets.length > 0) {
      const successfulBudgets = completedBudgets.filter(b => b.utilizationPercentage <= 100);
      performance.overview.successRate = (successfulBudgets.length / completedBudgets.length) * 100;
    } else {
      performance.overview.successRate = null;
    }

    // Category performance across all budgets
    const categoryPerformance = {};
    budgets.forEach(budget => {
      budget.categories.forEach(cat => {
        const categoryId = cat.category._id.toString();
        if (!categoryPerformance[categoryId]) {
          categoryPerformance[categoryId] = {
            category: cat.category,
            budgets: [],
            totalBudget: 0,
            totalSpent: 0,
            budgetCount: 0
          };
        }
        
        categoryPerformance[categoryId].budgets.push({
          budgetId: budget._id,
          budgetName: budget.name,
          budgetAmount: cat.budgetAmount,
          spentAmount: cat.spentAmount,
          utilization: cat.budgetAmount > 0 ? (cat.spentAmount / cat.budgetAmount) * 100 : 0
        });
        
        categoryPerformance[categoryId].totalBudget += cat.budgetAmount;
        categoryPerformance[categoryId].totalSpent += cat.spentAmount;
        categoryPerformance[categoryId].budgetCount += 1;
      });
    });

    performance.categoryPerformance = Object.values(categoryPerformance).map(cat => ({
      ...cat,
      averageUtilization: cat.totalBudget > 0 ? (cat.totalSpent / cat.totalBudget) * 100 : 0,
      averageBudget: cat.totalBudget / cat.budgetCount,
      averageSpent: cat.totalSpent / cat.budgetCount
    }));

    // Monthly trends
    const monthlyTrends = await Budget.aggregate([
      {
        $match: {
          user: req.user._id,
          startDate: { $gte: yearAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startDate' },
            month: { $month: '$startDate' }
          },
          budgetCount: { $sum: 1 },
          totalBudget: { $sum: '$totalBudget' },
          totalSpent: { $sum: '$totalSpent' },
          avgUtilization: {
            $avg: {
              $cond: [
                { $gt: ['$totalBudget', 0] },
                { $multiply: [{ $divide: ['$totalSpent', '$totalBudget'] }, 100] },
                0
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    performance.monthlyTrends = monthlyTrends;

    res.json({
      message: 'Budget performance report retrieved successfully',
      performance
    });

  } catch (error) {
    console.error('Get budget performance error:', error);
    res.status(500).json({
      message: 'Server error generating budget performance report'
    });
  }
});

// @route   GET /api/reports/cash-flow
// @desc    Get cash flow report
// @access  Private
router.get('/cash-flow', [
  query('period')
    .optional()
    .isIn(['month', 'quarter', 'year'])
    .withMessage('Invalid period'),
  query('granularity')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Invalid granularity')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { period = 'month', granularity = 'daily' } = req.query;

    const now = new Date();
    let startDate;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Build aggregation pipeline based on granularity
    let dateGrouping;
    switch (granularity) {
      case 'daily':
        dateGrouping = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        break;
      case 'weekly':
        dateGrouping = {
          $dateToString: {
            format: '%Y-W%U',
            date: '$date'
          }
        };
        break;
      case 'monthly':
        dateGrouping = { $dateToString: { format: '%Y-%m', date: '$date' } };
        break;
    }

    const cashFlowData = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate, $lte: now },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            period: dateGrouping,
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
            }
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
            }
          },
          incomeCount: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'income'] }, '$count', 0]
            }
          },
          expenseCount: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$count', 0]
            }
          }
        }
      },
      {
        $addFields: {
          netFlow: { $subtract: ['$income', '$expense'] },
          totalTransactions: { $add: ['$incomeCount', '$expenseCount'] }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Calculate running balance
    let runningBalance = 0;
    const cashFlowWithBalance = cashFlowData.map(item => {
      runningBalance += item.netFlow;
      return {
        ...item,
        runningBalance
      };
    });

    // Calculate summary statistics
    const summary = {
      totalIncome: cashFlowData.reduce((sum, item) => sum + item.income, 0),
      totalExpense: cashFlowData.reduce((sum, item) => sum + item.expense, 0),
      netCashFlow: 0,
      averageDailyIncome: 0,
      averageDailyExpense: 0,
      positiveFlowPeriods: 0,
      negativeFlowPeriods: 0
    };

    summary.netCashFlow = summary.totalIncome - summary.totalExpense;
    summary.positiveFlowPeriods = cashFlowData.filter(item => item.netFlow > 0).length;
    summary.negativeFlowPeriods = cashFlowData.filter(item => item.netFlow < 0).length;

    if (cashFlowData.length > 0) {
      summary.averageDailyIncome = summary.totalIncome / cashFlowData.length;
      summary.averageDailyExpense = summary.totalExpense / cashFlowData.length;
    }

    // Get top income and expense sources
    const [topIncomeSources, topExpenseSources] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'income',
            date: { $gte: startDate, $lte: now },
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: '$category',
            categoryName: { $first: '$categoryInfo.name' },
            categoryColor: { $first: '$categoryInfo.color' },
            categoryIcon: { $first: '$categoryInfo.icon' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        },
        {
          $limit: 5
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'expense',
            date: { $gte: startDate, $lte: now },
            status: 'completed'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $group: {
            _id: '$category',
            categoryName: { $first: '$categoryInfo.name' },
            categoryColor: { $first: '$categoryInfo.color' },
            categoryIcon: { $first: '$categoryInfo.icon' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        },
        {
          $limit: 5
        }
      ])
    ]);

    res.json({
      message: 'Cash flow report retrieved successfully',
      period,
      granularity,
      dateRange: { start: startDate, end: now },
      summary,
      cashFlow: cashFlowWithBalance,
      topIncomeSources,
      topExpenseSources
    });

  } catch (error) {
    console.error('Get cash flow report error:', error);
    res.status(500).json({
      message: 'Server error generating cash flow report'
    });
  }
});

// @route   GET /api/reports/export
// @desc    Export financial data
// @access  Private
router.get('/export', [
  query('format')
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('type')
    .isIn(['transactions', 'budgets', 'categories', 'all'])
    .withMessage('Invalid export type'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { format, type, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    let exportData = {};

    // Export transactions
    if (type === 'transactions' || type === 'all') {
      const transactionFilter = { user: req.user._id };
      if (Object.keys(dateFilter).length > 0) {
        transactionFilter.date = dateFilter;
      }

      exportData.transactions = await Transaction.find(transactionFilter)
        .populate('category', 'name type')
        .select('-user -__v')
        .lean();
    }

    // Export budgets
    if (type === 'budgets' || type === 'all') {
      const budgetFilter = { user: req.user._id };
      if (Object.keys(dateFilter).length > 0) {
        budgetFilter.startDate = dateFilter;
      }

      exportData.budgets = await Budget.find(budgetFilter)
        .populate('categories.category', 'name type')
        .select('-user -__v')
        .lean();
    }

    // Export categories
    if (type === 'categories' || type === 'all') {
      exportData.categories = await Category.find({ user: req.user._id })
        .populate('parent', 'name')
        .select('-user -__v')
        .lean();
    }

    // Format response based on requested format
    if (format === 'csv') {
      // For CSV, we'll return JSON with instructions to convert
      // In a real application, you'd use a CSV library here
      res.json({
        message: 'Export data prepared (CSV conversion needed on client)',
        data: exportData,
        format: 'csv'
      });
    } else {
      res.json({
        message: 'Data exported successfully',
        exportDate: new Date(),
        dateRange: Object.keys(dateFilter).length > 0 ? dateFilter : null,
        data: exportData
      });
    }

  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({
      message: 'Server error exporting data'
    });
  }
});

/* module.exports set at file end */
// @route   POST /api/reports/email/weekly
// @desc    Send weekly financial summary email
// @access  Private
router.post('/email/weekly', auth, async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    const dateRange = { $gte: start, $lte: now };

    const [incomeExpenseSummary, categoryBreakdown] = await Promise.all([
      Transaction.aggregate([
        { $match: { user: req.user._id, date: dateRange, status: 'completed' } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 }, average: { $avg: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: req.user._id, date: dateRange, status: 'completed' } },
        { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryInfo' } },
        { $unwind: '$categoryInfo' },
        { $group: { _id: { category: '$category', type: '$type' }, categoryName: { $first: '$categoryInfo.name' }, categoryColor: { $first: '$categoryInfo.color' }, categoryIcon: { $first: '$categoryInfo.icon' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ])
    ]);

    const summary = { income: 0, expense: 0, netIncome: 0, transactionCount: 0 };
    incomeExpenseSummary.forEach(item => { summary[item._id] = item.total; summary.transactionCount += item.count; });
    summary.netIncome = summary.income - summary.expense;

    const topCategories = categoryBreakdown
      .filter(c => c._id.type === 'expense')
      .slice(0, 5)
      .map(c => ({ categoryName: c.categoryName, total: c.total }));

    // Respect user preference if set
    if (req.user.notifications && req.user.notifications.weeklyReports === false) {
      return res.status(400).json({ message: 'Weekly report emails are disabled in your settings.' });
    }

    const report = { summary, topCategories, periodRange: { start, end: now } };
    const xlsxBuffer = await emailService.generateReportXlsxBuffer(req.user, report, 'weekly');
    const fileName = `pfims_weekly_report_${now.toISOString().slice(0, 10)}.xlsx`;
    const result = await emailService.sendReportEmail(req.user, report, 'weekly', {
      attachments: [
        {
          filename: fileName,
          content: xlsxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    });

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send weekly report email', error: result.error });
    }

    res.json({ message: 'Weekly report email has been queued', result });
  } catch (error) {
    console.error('Send weekly report email error:', error);
    res.status(500).json({ message: 'Server error sending weekly report email' });
  }
});

// @route   POST /api/reports/email/monthly
// @desc    Send monthly financial summary email
// @access  Private
router.post('/email/monthly', auth, async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateRange = { $gte: start, $lte: now };

    const [incomeExpenseSummary, categoryBreakdown] = await Promise.all([
      Transaction.aggregate([
        { $match: { user: req.user._id, date: dateRange, status: 'completed' } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 }, average: { $avg: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { user: req.user._id, date: dateRange, status: 'completed' } },
        { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryInfo' } },
        { $unwind: '$categoryInfo' },
        { $group: { _id: { category: '$category', type: '$type' }, categoryName: { $first: '$categoryInfo.name' }, categoryColor: { $first: '$categoryInfo.color' }, categoryIcon: { $first: '$categoryInfo.icon' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ])
    ]);

    const summary = { income: 0, expense: 0, netIncome: 0, transactionCount: 0 };
    incomeExpenseSummary.forEach(item => { summary[item._id] = item.total; summary.transactionCount += item.count; });
    summary.netIncome = summary.income - summary.expense;

    const topCategories = categoryBreakdown
      .filter(c => c._id.type === 'expense')
      .slice(0, 5)
      .map(c => ({ categoryName: c.categoryName, total: c.total }));

    // Respect user preference if set
    if (req.user.notifications && req.user.notifications.monthlyReports === false) {
      return res.status(400).json({ message: 'Monthly report emails are disabled in your settings.' });
    }

    const report = { summary, topCategories, periodRange: { start, end: now } };
    const result = await emailService.sendReportEmail(req.user, report, 'monthly');

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send monthly report email', error: result.error });
    }

    res.json({ message: 'Monthly report email has been queued', result });
  } catch (error) {
    console.error('Send monthly report email error:', error);
    res.status(500).json({ message: 'Server error sending monthly report email' });
  }
});

module.exports = router;
