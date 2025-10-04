const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const { auth, checkOwnership } = require('../middleware/auth');

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
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
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

    // Build filter
    const filter = { user: req.user._id };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      // Escape special regex characters to prevent ReDoS attacks
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('category', 'name color icon type')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(filter)
    ]);

    // Calculate summary statistics
    const summary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summaryStats = summary.reduce((acc, stat) => {
      acc[stat._id] = {
        total: stat.total,
        count: stat.count
      };
      return acc;
    }, {});

    res.json({
      message: 'Transactions retrieved successfully',
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      },
      summary: summaryStats
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      message: 'Server error retrieving transactions'
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
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Verify category belongs to user
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

    // Verify category type matches transaction type
    if (category.type !== 'both' && category.type !== req.body.type) {
      return res.status(400).json({
        message: `Category is for ${category.type} transactions only`
      });
    }

    const transaction = new Transaction({
      ...req.body,
      user: req.user._id,
      currency: req.user.currency
    });

    await transaction.save();

    // Update budget spent amounts if this is an expense
    if (transaction.type === 'expense') {
      const activeBudgets = await Budget.find({
        user: req.user._id,
        isActive: true,
        startDate: { $lte: transaction.date },
        endDate: { $gte: transaction.date }
      });

      for (const budget of activeBudgets) {
        await budget.updateSpentAmounts();
      }
    }

    // Populate category for response
    await transaction.populate('category', 'name color icon type');

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      message: 'Server error creating transaction'
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
      });

      for (const budget of activeBudgets) {
        await budget.updateSpentAmounts();
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
    let dateRange = {};
    const now = new Date();

    if (period === 'custom' && startDate && endDate) {
      dateRange = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      switch (period) {
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          dateRange = { $gte: weekStart };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateRange = { $gte: monthStart };
          break;
        case 'quarter':
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          dateRange = { $gte: quarterStart };
          break;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          dateRange = { $gte: yearStart };
          break;
      }
    }

    // Aggregate transaction data
    const pipeline = [
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
            type: '$type',
            category: '$category',
            categoryName: '$categoryInfo.name',
            categoryColor: '$categoryInfo.color'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          total: { $sum: '$total' },
          count: { $sum: '$count' },
          categories: {
            $push: {
              id: '$_id.category',
              name: '$_id.categoryName',
              color: '$_id.categoryColor',
              total: '$total',
              count: '$count',
              avgAmount: '$avgAmount'
            }
          }
        }
      }
    ];

    const results = await Transaction.aggregate(pipeline);

    // Format response
    const summary = {
      period,
      dateRange: {
        start: dateRange.$gte || null,
        end: dateRange.$lte || null
      },
      totals: {
        income: 0,
        expense: 0,
        net: 0
      },
      categories: {
        income: [],
        expense: []
      },
      transactionCounts: {
        income: 0,
        expense: 0,
        total: 0
      }
    };

    results.forEach(result => {
      summary.totals[result._id] = result.total;
      summary.categories[result._id] = result.categories.sort((a, b) => b.total - a.total);
      summary.transactionCounts[result._id] = result.count;
    });

    summary.totals.net = summary.totals.income - summary.totals.expense;
    summary.transactionCounts.total = summary.transactionCounts.income + summary.transactionCounts.expense;

    res.json({
      message: 'Analytics summary retrieved successfully',
      summary
    });

  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({
      message: 'Server error retrieving analytics'
    });
  }
});

module.exports = router;