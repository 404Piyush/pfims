const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const User = require('../models/User');
const { auth, checkOwnership } = require('../middleware/auth');
const { handleValidationErrors, apiRateLimit, expensiveOperationSlowDown } = require('../middleware/validation');
const QueryOptimizer = require('../utils/queryOptimizer');
const BudgetAlertService = require('../utils/budgetAlertService');
const emailService = require('../utils/emailService');

const router = express.Router();

// @route   GET /api/transactions
// @desc    Get user transactions with filtering and pagination
// @access  Private
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Invalid transaction type'),
  query('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date'),
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be positive'),
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be positive'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
], auth, apiRateLimit, handleValidationErrors, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build optimized query
    const filters = {
      type,
      category: QueryOptimizer.validateObjectId(category),
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null) {
        delete filters[key];
      }
    });

    const query = QueryOptimizer.buildTransactionQuery(req.user._id, filters);
    const sortOptions = QueryOptimizer.buildSortOptions(sortBy, sortOrder);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute optimized queries in parallel
    const [transactions, total] = await Promise.all([
      QueryOptimizer.optimizeQuery(
        Transaction.find(query)
          .populate('category', 'name color icon type')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        { lean: true }
      ),
      Transaction.countDocuments(query)
    ]);

    // Calculate summary statistics
    const summaryPipeline = QueryOptimizer.buildTransactionAnalyticsPipeline(req.user._id, filters);
    summaryPipeline.push({
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
          }
        },
        totalExpense: {
          $sum: {
            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
          }
        },
        count: { $sum: 1 }
      }
    });

    const [summary] = await Transaction.aggregate(summaryPipeline);

    const response = {
      success: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        },
        summary: summary || {
          totalIncome: 0,
          totalExpense: 0,
          count: 0
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', auth, checkOwnership(Transaction), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('category', 'name color icon type');

    res.json({
      message: 'Transaction retrieved successfully',
      transaction
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      message: 'Server error retrieving transaction'
    });
  }
});

// @route   POST /api/transactions
// @desc    Create new transaction
// @access  Private
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('type')
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Type must be income, expense, or transfer'),
  body('category')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('account')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Account must be between 1 and 50 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], auth, handleValidationErrors, async (req, res) => {
  try {
    // Verify category belongs to user and is active
    const category = await Category.findOne({
      _id: req.body.category,
      user: req.user._id,
      isActive: true
    }).lean();

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or category does not belong to user'
      });
    }

    // Verify category type matches transaction type
    if (category.type !== 'both' && category.type !== req.body.type) {
      return res.status(400).json({
        success: false,
        message: `Category is for ${category.type} transactions only`
      });
    }

    // Create transaction with optimized data
    const transactionData = {
      ...req.body,
      user: req.user._id,
      currency: req.user.currency || 'USD',
      date: req.body.date ? new Date(req.body.date) : new Date()
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Update budget spent amounts if this is an expense (optimized)
    if (transaction.type === 'expense') {
      const activeBudgets = await Budget.find({
        user: req.user._id,
        isActive: true,
        startDate: { $lte: transaction.date },
        endDate: { $gte: transaction.date },
        'categories.category': transaction.category
      }).populate('categories.category');

      // Update budgets and check for alerts
      for (const budget of activeBudgets) {
        // Update spent amounts
        await budget.updateSpentAmounts();
        
        // Check and send budget alerts
        await BudgetAlertService.checkAndSendAlerts(budget, transaction);
      }
    }

    // Send transaction notification email if enabled
    try {
      const user = await User.findById(req.user._id);
      if (user && user.notifications && user.notifications.email && user.notifications.transactionAlerts) {
        await emailService.sendTransactionNotificationEmail(user, transaction, category);
      }
    } catch (emailError) {
      console.warn('Failed to send transaction notification email:', emailError.message);
      // Don't fail the transaction creation if email fails
    }

    // Populate category for response
    await transaction.populate('category', 'name color icon type');

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transaction
      }
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating transaction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('type')
    .optional()
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Type must be income, expense, or transfer'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
], auth, checkOwnership(Transaction), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // If category is being updated, verify it
    if (req.body.category) {
      const category = await Category.findOne({
        _id: req.body.category,
        user: req.user._id,
        isActive: true
      });

      if (!category) {
        return res.status(400).json({
          message: 'Invalid category or category does not belong to user'
        });
      }

      const transactionType = req.body.type || req.resource.type;
      if (category.type !== 'both' && category.type !== transactionType) {
        return res.status(400).json({
          message: `Category is for ${category.type} transactions only`
        });
      }
    }

    const allowedUpdates = [
      'title', 'description', 'amount', 'type', 'category', 
      'account', 'paymentMethod', 'date', 'location', 
      'tags', 'notes', 'status'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('category', 'name color icon type');

    // Update budget spent amounts if amount or date changed
    if (updates.amount || updates.date || updates.type) {
      const activeBudgets = await Budget.find({
        user: req.user._id,
        isActive: true
      }).populate('categories.category');

      for (const budget of activeBudgets) {
        await budget.updateSpentAmounts();
        
        // Check for budget alerts if this is an expense transaction
        if (transaction.type === 'expense') {
          await BudgetAlertService.checkAndSendAlerts(budget, transaction);
        }
      }
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      message: 'Server error updating transaction'
    });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', auth, checkOwnership(Transaction), async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);

    // Update budget spent amounts
    const activeBudgets = await Budget.find({
      user: req.user._id,
      isActive: true
    });

    for (const budget of activeBudgets) {
      await budget.updateSpentAmounts();
    }

    res.json({
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      message: 'Server error deleting transaction'
    });
  }
});

// @route   GET /api/transactions/analytics/summary
// @desc    Get transaction analytics summary
// @access  Private
router.get('/analytics/summary', [
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year', 'custom'])
    .withMessage('Invalid period'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date')
], auth, expensiveOperationSlowDown, handleValidationErrors, async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
      dateRange = QueryOptimizer.buildDateRange(startDate, endDate);
    } else {
      // Build date range based on period
      const now = new Date();
      switch (period) {
        case 'week':
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          dateRange = { $gte: weekStart, $lte: weekEnd };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          dateRange = { $gte: monthStart, $lte: monthEnd };
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
          const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
          dateRange = { $gte: quarterStart, $lte: quarterEnd };
          break;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          dateRange = { $gte: yearStart, $lte: yearEnd };
          break;
        default:
          const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          dateRange = { $gte: defaultStart, $lte: defaultEnd };
      }
    }

    // Build comprehensive analytics pipeline
    const pipeline = [
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          date: dateRange
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
            type: '$type',
            category: '$category',
            categoryName: '$categoryInfo.name',
            categoryColor: '$categoryInfo.color'
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          categories: {
            $push: {
              category: '$_id.category',
              name: '$_id.categoryName',
              color: '$_id.categoryColor',
              totalAmount: '$totalAmount',
              transactionCount: '$transactionCount',
              avgAmount: '$avgAmount',
              maxAmount: '$maxAmount',
              minAmount: '$minAmount',
              percentage: '$totalAmount'
            }
          },
          totalByType: { $sum: '$totalAmount' },
          transactionCountByType: { $sum: '$transactionCount' }
        }
      }
    ];

    // Execute analytics query
    const analyticsResult = await Transaction.aggregate(pipeline);

    // Calculate percentages and format data
    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      netIncome: 0,
      transactionCount: 0,
      categories: {
        income: [],
        expense: []
      },
      trends: {
        period,
        dateRange: {
          start: dateRange.$gte,
          end: dateRange.$lte
        }
      }
    };

    analyticsResult.forEach(typeGroup => {
      const type = typeGroup._id;
      summary[`total${type.charAt(0).toUpperCase() + type.slice(1)}`] = typeGroup.totalByType;
      summary.transactionCount += typeGroup.transactionCountByType;

      // Calculate percentages for categories
      typeGroup.categories.forEach(cat => {
        cat.percentage = ((cat.totalAmount / typeGroup.totalByType) * 100).toFixed(2);
      });

      // Sort categories by amount (descending)
      typeGroup.categories.sort((a, b) => b.totalAmount - a.totalAmount);
      summary.categories[type] = typeGroup.categories;
    });

    summary.netIncome = summary.totalIncome - summary.totalExpense;

    // Get monthly trend data for the period
    const trendPipeline = [
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          date: dateRange
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];

    const trendData = await Transaction.aggregate(trendPipeline);
    summary.trends.monthlyData = trendData;

    res.json({
      success: true,
      message: 'Transaction summary retrieved successfully',
      data: summary
    });

  } catch (error) {
    console.error('Transaction summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transaction summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;