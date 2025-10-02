const express = require('express');
const { body, validationResult } = require('express-validator');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { auth, checkOwnership } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/budgets
// @desc    Get user budgets
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      active = true, 
      period, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { user: req.user._id };
    if (active !== 'all') {
      filter.isActive = active === 'true';
    }
    if (period) {
      filter.period = period;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [budgets, total] = await Promise.all([
      Budget.find(filter)
        .populate('categories.category', 'name color icon type')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Budget.countDocuments(filter)
    ]);

    // Calculate current status for each budget
    const budgetsWithStatus = budgets.map(budget => {
      const budgetObj = budget.toObject();
      return {
        ...budgetObj,
        utilizationPercentage: budget.utilizationPercentage,
        remainingBudget: budget.remainingBudget,
        daysRemaining: budget.daysRemaining,
        status: budget.budgetStatus
      };
    });

    res.json({
      message: 'Budgets retrieved successfully',
      budgets: budgetsWithStatus,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      message: 'Server error retrieving budgets'
    });
  }
});

// @route   GET /api/budgets/active
// @desc    Get active budgets summary
// @access  Private
router.get('/active', auth, async (req, res) => {
  try {
    const activeBudgets = await Budget.getActiveBudgets(req.user._id);

    const summary = {
      totalBudgets: activeBudgets.length,
      totalBudgetAmount: activeBudgets.reduce((sum, budget) => sum + budget.totalBudget, 0),
      totalSpent: activeBudgets.reduce((sum, budget) => sum + budget.totalSpent, 0),
      budgetsOverLimit: activeBudgets.filter(budget => budget.utilizationPercentage > 100).length,
      budgetsNearLimit: activeBudgets.filter(budget => 
        budget.utilizationPercentage > 80 && budget.utilizationPercentage <= 100
      ).length
    };

    res.json({
      message: 'Active budgets retrieved successfully',
      budgets: activeBudgets,
      summary
    });

  } catch (error) {
    console.error('Get active budgets error:', error);
    res.status(500).json({
      message: 'Server error retrieving active budgets'
    });
  }
});

// @route   GET /api/budgets/:id
// @desc    Get single budget with detailed analytics
// @access  Private
router.get('/:id', auth, checkOwnership(Budget), async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id)
      .populate('categories.category', 'name color icon type');

    // Get spending trends for this budget period
    const spendingTrends = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          category: { $in: budget.categories.map(cat => cat.category._id) },
          date: { $gte: budget.startDate, $lte: budget.endDate },
          type: 'expense',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          dailySpent: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get category breakdown
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          category: { $in: budget.categories.map(cat => cat.category._id) },
          date: { $gte: budget.startDate, $lte: budget.endDate },
          type: 'expense',
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$category',
          spent: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgTransaction: { $avg: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      }
    ]);

    const budgetWithAnalytics = {
      ...budget.toObject(),
      utilizationPercentage: budget.utilizationPercentage,
      remainingBudget: budget.remainingBudget,
      daysRemaining: budget.daysRemaining,
      status: budget.budgetStatus,
      analytics: {
        spendingTrends,
        categoryBreakdown
      }
    };

    res.json({
      message: 'Budget retrieved successfully',
      budget: budgetWithAnalytics
    });

  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({
      message: 'Server error retrieving budget'
    });
  }
});

// @route   POST /api/budgets
// @desc    Create new budget
// @access  Private
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('period')
    .isIn(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Period must be weekly, monthly, quarterly, yearly, or custom'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('categories')
    .isArray({ min: 1 })
    .withMessage('At least one category is required'),
  body('categories.*.category')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('categories.*.budget')
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { categories, startDate, endDate, ...budgetData } = req.body;

    // Validate date range
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: 'End date must be after start date'
      });
    }

    // Verify all categories belong to user
    const categoryIds = categories.map(cat => cat.category);
    const userCategories = await Category.find({
      _id: { $in: categoryIds },
      user: req.user._id,
      isActive: true
    });

    if (userCategories.length !== categories.length) {
      return res.status(400).json({
        message: 'Some categories do not belong to user or are inactive'
      });
    }

    // Check for overlapping budgets with same categories
    const overlappingBudgets = await Budget.find({
      user: req.user._id,
      isActive: true,
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ],
      'categories.category': { $in: categoryIds }
    });

    if (overlappingBudgets.length > 0) {
      return res.status(400).json({
        message: 'Budget period overlaps with existing budgets for some categories',
        overlappingBudgets: overlappingBudgets.map(budget => ({
          id: budget._id,
          name: budget.name,
          period: `${budget.startDate.toISOString().split('T')[0]} to ${budget.endDate.toISOString().split('T')[0]}`
        }))
      });
    }

    const budget = new Budget({
      ...budgetData,
      user: req.user._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      categories: categories.map(cat => ({
        category: cat.category,
        budget: cat.budget,
        spent: 0
      }))
    });

    await budget.save();
    await budget.populate('categories.category', 'name color icon type');

    res.status(201).json({
      message: 'Budget created successfully',
      budget
    });

  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({
      message: 'Server error creating budget'
    });
  }
});

// @route   PUT /api/budgets/:id
// @desc    Update budget
// @access  Private
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('categories')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one category is required'),
  body('categories.*.category')
    .optional()
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('categories.*.budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], auth, checkOwnership(Budget), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Prevent updating period dates if budget has started
    const now = new Date();
    if (req.resource.startDate <= now && (req.body.startDate || req.body.endDate)) {
      return res.status(400).json({
        message: 'Cannot modify dates of an active budget'
      });
    }

    // If categories are being updated, verify they belong to user
    if (req.body.categories) {
      const categoryIds = req.body.categories.map(cat => cat.category);
      const userCategories = await Category.find({
        _id: { $in: categoryIds },
        user: req.user._id,
        isActive: true
      });

      if (userCategories.length !== req.body.categories.length) {
        return res.status(400).json({
          message: 'Some categories do not belong to user or are inactive'
        });
      }

      // Update spent amounts for new categories
      req.body.categories = await Promise.all(
        req.body.categories.map(async (cat) => {
          const existingCategory = req.resource.categories.find(
            existing => existing.category.toString() === cat.category
          );

          if (existingCategory) {
            return {
              category: cat.category,
              budget: cat.budget,
              spent: existingCategory.spent
            };
          } else {
            // Calculate spent amount for new category
            const spent = await Transaction.aggregate([
              {
                $match: {
                  user: req.user._id,
                  category: cat.category,
                  date: { $gte: req.resource.startDate, $lte: req.resource.endDate },
                  type: 'expense',
                  status: 'completed'
                }
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$amount' }
                }
              }
            ]);

            return {
              category: cat.category,
              budget: cat.budget,
              spent: spent.length > 0 ? spent[0].total : 0
            };
          }
        })
      );
    }

    const allowedUpdates = [
      'name', 'description', 'categories', 'notifications', 
      'rolloverUnused', 'isActive'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const budget = await Budget.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('categories.category', 'name color icon type');

    res.json({
      message: 'Budget updated successfully',
      budget
    });

  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      message: 'Server error updating budget'
    });
  }
});

// @route   DELETE /api/budgets/:id
// @desc    Delete budget
// @access  Private
router.delete('/:id', auth, checkOwnership(Budget), async (req, res) => {
  try {
    await Budget.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Budget deleted successfully'
    });

  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      message: 'Server error deleting budget'
    });
  }
});

// @route   POST /api/budgets/:id/refresh
// @desc    Refresh budget spent amounts
// @access  Private
router.post('/:id/refresh', auth, checkOwnership(Budget), async (req, res) => {
  try {
    await req.resource.updateSpentAmounts();

    const refreshedBudget = await Budget.findById(req.params.id)
      .populate('categories.category', 'name color icon type');

    res.json({
      message: 'Budget amounts refreshed successfully',
      budget: refreshedBudget
    });

  } catch (error) {
    console.error('Refresh budget error:', error);
    res.status(500).json({
      message: 'Server error refreshing budget'
    });
  }
});

// @route   POST /api/budgets/templates
// @desc    Create budget from template
// @access  Private
router.post('/templates', [
  body('templateType')
    .isIn(['basic', 'detailed', '50-30-20', 'zero-based'])
    .withMessage('Invalid template type'),
  body('monthlyIncome')
    .isFloat({ min: 0 })
    .withMessage('Monthly income must be a positive number'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('period')
    .isIn(['monthly', 'quarterly', 'yearly'])
    .withMessage('Period must be monthly, quarterly, or yearly')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { templateType, monthlyIncome, startDate, period } = req.body;

    // Get user's categories
    const userCategories = await Category.find({
      user: req.user._id,
      isActive: true,
      type: { $in: ['expense', 'both'] }
    });

    if (userCategories.length === 0) {
      return res.status(400).json({
        message: 'No expense categories found. Please create categories first.'
      });
    }

    const budget = await Budget.createFromTemplate(
      req.user._id,
      templateType,
      monthlyIncome,
      new Date(startDate),
      period,
      userCategories
    );

    await budget.populate('categories.category', 'name color icon type');

    res.status(201).json({
      message: 'Budget created from template successfully',
      budget
    });

  } catch (error) {
    console.error('Create budget from template error:', error);
    res.status(500).json({
      message: 'Server error creating budget from template'
    });
  }
});

// @route   GET /api/budgets/analytics/performance
// @desc    Get budget performance analytics
// @access  Private
router.get('/analytics/performance', auth, async (req, res) => {
  try {
    const { period = 'year' } = req.query;

    // Calculate date range
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
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    const budgets = await Budget.find({
      user: req.user._id,
      startDate: { $gte: startDate }
    }).populate('categories.category', 'name color icon');

    const performance = {
      totalBudgets: budgets.length,
      activeBudgets: budgets.filter(b => b.isActive).length,
      completedBudgets: budgets.filter(b => !b.isActive && b.endDate < now).length,
      averageUtilization: 0,
      budgetsOverBudget: 0,
      budgetsUnderBudget: 0,
      totalBudgetAmount: 0,
      totalSpentAmount: 0,
      categoryPerformance: {},
      monthlyTrends: []
    };

    if (budgets.length > 0) {
      const utilizations = budgets.map(b => b.utilizationPercentage);
      performance.averageUtilization = utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length;
      performance.budgetsOverBudget = budgets.filter(b => b.utilizationPercentage > 100).length;
      performance.budgetsUnderBudget = budgets.filter(b => b.utilizationPercentage < 100).length;
      performance.totalBudgetAmount = budgets.reduce((sum, b) => sum + b.totalBudget, 0);
      performance.totalSpentAmount = budgets.reduce((sum, b) => sum + b.totalSpent, 0);

      // Category performance analysis
      const categoryStats = {};
      budgets.forEach(budget => {
        budget.categories.forEach(cat => {
          const categoryId = cat.category._id.toString();
          if (!categoryStats[categoryId]) {
            categoryStats[categoryId] = {
              name: cat.category.name,
              color: cat.category.color,
              icon: cat.category.icon,
              totalBudget: 0,
              totalSpent: 0,
              budgetCount: 0
            };
          }
          categoryStats[categoryId].totalBudget += cat.budget;
          categoryStats[categoryId].totalSpent += cat.spent;
          categoryStats[categoryId].budgetCount += 1;
        });
      });

      performance.categoryPerformance = Object.values(categoryStats).map(cat => ({
        ...cat,
        utilizationPercentage: cat.totalBudget > 0 ? (cat.totalSpent / cat.totalBudget) * 100 : 0,
        averageBudget: cat.totalBudget / cat.budgetCount,
        averageSpent: cat.totalSpent / cat.budgetCount
      }));
    }

    res.json({
      message: 'Budget performance analytics retrieved successfully',
      period,
      performance
    });

  } catch (error) {
    console.error('Get budget performance error:', error);
    res.status(500).json({
      message: 'Server error retrieving budget performance'
    });
  }
});

module.exports = router;