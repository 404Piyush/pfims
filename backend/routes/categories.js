const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { auth, checkOwnership } = require('../middleware/auth');
const { handleValidationErrors, apiRateLimit, expensiveOperationSlowDown } = require('../middleware/validation');
const QueryOptimizer = require('../utils/queryOptimizer');

const router = express.Router();

// @route   GET /api/categories
// @desc    Get user categories with filtering and optimization
// @access  Private
router.get('/', [
  query('type')
    .optional()
    .isIn(['income', 'expense', 'both', 'all'])
    .withMessage('Type must be income, expense, both, or all'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
  query('parent')
    .optional()
    .custom(value => value === 'null' || require('mongoose').Types.ObjectId.isValid(value))
    .withMessage('Parent must be a valid ObjectId or null'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('includeStats')
    .optional()
    .isBoolean()
    .withMessage('includeStats must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['name', 'type', 'order', 'createdAt', 'transactionCount'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
], auth, apiRateLimit, handleValidationErrors, async (req, res) => {
  try {
    const { 
      type = 'all', 
      includeInactive = false, 
      parent,
      search,
      includeStats = true,
      sortBy = 'order',
      sortOrder = 'asc'
    } = req.query;

    // Build optimized query filter
    const filter = QueryOptimizer.buildCategoryQuery(req.user._id, {
      type,
      includeInactive: includeInactive === 'true',
      parent,
      search
    });

    // Build sort options
    const sortOptions = QueryOptimizer.buildSortOptions(sortBy, sortOrder);

    // Execute main query
    const categories = await Category.find(filter)
      .populate('parent', 'name color icon type')
      .sort(sortOptions)
      .lean();

    let categoriesWithData = categories;

    // Add transaction statistics if requested
    if (includeStats === 'true') {
      // Use aggregation for better performance when getting transaction counts
      const transactionCounts = await Transaction.aggregate([
        {
          $match: {
            category: { $in: categories.map(cat => cat._id) },
            user: req.user._id
          }
        },
        {
          $group: {
            _id: '$category',
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            lastTransactionDate: { $max: '$date' }
          }
        }
      ]);

      // Create a map for quick lookup
      const statsMap = new Map(
        transactionCounts.map(stat => [stat._id.toString(), stat])
      );

      // Add stats to categories
      categoriesWithData = categories.map(category => {
        const stats = statsMap.get(category._id.toString()) || {
          totalTransactions: 0,
          totalAmount: 0,
          lastTransactionDate: null
        };

        return {
          ...category,
          transactionCount: stats.totalTransactions,
          totalAmount: stats.totalAmount,
          lastTransactionDate: stats.lastTransactionDate,
          hasTransactions: stats.totalTransactions > 0
        };
      });
    }

    // Build category tree structure for hierarchical display
    const categoryTree = await Category.aggregate([
      {
        $match: filter
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: 'parent',
          as: 'children'
        }
      },
      {
        $match: {
          parent: null // Only root categories for tree structure
        }
      },
      {
        $sort: sortOptions
      }
    ]);

    // Calculate summary statistics
    const summary = {
      totalCategories: categories.length,
      activeCategories: categories.filter(cat => cat.isActive).length,
      inactiveCategories: categories.filter(cat => !cat.isActive).length,
      incomeCategories: categories.filter(cat => cat.type === 'income' || cat.type === 'both').length,
      expenseCategories: categories.filter(cat => cat.type === 'expense' || cat.type === 'both').length,
      parentCategories: categories.filter(cat => !cat.parent).length,
      subcategories: categories.filter(cat => cat.parent).length
    };

    if (includeStats === 'true') {
      summary.categoriesWithTransactions = categoriesWithData.filter(cat => cat.hasTransactions).length;
      summary.totalTransactionAmount = categoriesWithData.reduce((sum, cat) => sum + (cat.totalAmount || 0), 0);
    }

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: categoriesWithData,
        categoryTree: categoryTree,
        summary
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/categories/:id
// @desc    Get single category with usage statistics
// @access  Private
router.get('/:id', auth, checkOwnership(Category), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name color icon');

    // Get usage statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthlyStats, yearlyStats, totalStats, subcategories] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            category: category._id,
            date: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            category: category._id,
            date: { $gte: startOfYear }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            category: category._id
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Category.find({ parent: category._id, isActive: true })
        .select('name color icon type')
    ]);

    const formatStats = (stats) => {
      return stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.total,
          count: stat.count
        };
        return acc;
      }, {});
    };

    const categoryWithStats = {
      ...category.toObject(),
      statistics: {
        monthly: formatStats(monthlyStats),
        yearly: formatStats(yearlyStats),
        allTime: formatStats(totalStats)
      },
      subcategories
    };

    res.json({
      message: 'Category retrieved successfully',
      category: categoryWithStats
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      message: 'Server error retrieving category'
    });
  }
});

// @route   POST /api/categories
// @desc    Create new category
// @access  Private
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  body('type')
    .isIn(['income', 'expense', 'both'])
    .withMessage('Type must be income, expense, or both'),
  body('color')
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  body('icon')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Icon is required'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent must be a valid category ID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if category name already exists for this user
    const existingCategory = await Category.findOne({
      user: req.user._id,
      name: req.body.name,
      parent: req.body.parent || null,
      isActive: true
    });

    if (existingCategory) {
      return res.status(400).json({
        message: 'Category with this name already exists in the same level'
      });
    }

    // If parent is specified, verify it belongs to user and is active
    if (req.body.parent) {
      const parentCategory = await Category.findOne({
        _id: req.body.parent,
        user: req.user._id,
        isActive: true
      });

      if (!parentCategory) {
        return res.status(400).json({
          message: 'Parent category not found or does not belong to user'
        });
      }

      // Verify type compatibility
      if (parentCategory.type !== 'both' && parentCategory.type !== req.body.type && req.body.type !== 'both') {
        return res.status(400).json({
          message: 'Child category type must be compatible with parent category type'
        });
      }
    }

    const category = new Category({
      ...req.body,
      user: req.user._id
    });

    await category.save();
    await category.populate('parent', 'name color icon');

    res.status(201).json({
      message: 'Category created successfully',
      category
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      message: 'Server error creating category'
    });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  body('type')
    .optional()
    .isIn(['income', 'expense', 'both'])
    .withMessage('Type must be income, expense, or both'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent must be a valid category ID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
], auth, checkOwnership(Category), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Allow updating certain properties of default categories (color, description, budget)
    // but prevent changing core properties like name and type
    if (req.resource.isDefault && (req.body.name || req.body.type)) {
      return res.status(400).json({
        message: 'Cannot modify name or type of default categories'
      });
    }

    // Check name uniqueness if name is being updated
    if (req.body.name && req.body.name !== req.resource.name) {
      const existingCategory = await Category.findOne({
        user: req.user._id,
        name: req.body.name,
        parent: req.body.parent || req.resource.parent || null,
        _id: { $ne: req.params.id },
        isActive: true
      });

      if (existingCategory) {
        return res.status(400).json({
          message: 'Category with this name already exists in the same level'
        });
      }
    }

    // Verify parent category if being updated
    if (req.body.parent && req.body.parent !== req.resource.parent?.toString()) {
      const parentCategory = await Category.findOne({
        _id: req.body.parent,
        user: req.user._id,
        isActive: true
      });

      if (!parentCategory) {
        return res.status(400).json({
          message: 'Parent category not found or does not belong to user'
        });
      }

      // Prevent setting self as parent
      if (req.body.parent === req.params.id) {
        return res.status(400).json({
          message: 'Category cannot be its own parent'
        });
      }
    }

    const allowedUpdates = [
      'name', 'description', 'type', 'color', 'icon', 
      'parent', 'budget', 'order'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('parent', 'name color icon');

    res.json({
      message: 'Category updated successfully',
      category
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      message: 'Server error updating category'
    });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete/deactivate category
// @access  Private
router.delete('/:id', auth, checkOwnership(Category), async (req, res) => {
  try {
    // Prevent deletion of default categories
    if (req.resource.isDefault) {
      return res.status(400).json({
        message: 'Cannot delete default categories'
      });
    }

    // Check if category has transactions
    const transactionCount = await Transaction.countDocuments({
      category: req.params.id
    });

    if (transactionCount > 0) {
      // Soft delete - deactivate instead of removing
      await Category.findByIdAndUpdate(req.params.id, { isActive: false });
      
      res.json({
        message: 'Category deactivated successfully (has associated transactions)',
        deactivated: true
      });
    } else {
      // Check for subcategories
      const subcategories = await Category.find({
        parent: req.params.id,
        isActive: true
      });

      if (subcategories.length > 0) {
        return res.status(400).json({
          message: 'Cannot delete category with active subcategories',
          subcategories: subcategories.map(cat => ({
            id: cat._id,
            name: cat.name
          }))
        });
      }

      // Hard delete if no transactions or subcategories
      await Category.findByIdAndDelete(req.params.id);
      
      res.json({
        message: 'Category deleted successfully',
        deleted: true
      });
    }

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      message: 'Server error deleting category'
    });
  }
});

// @route   POST /api/categories/:id/restore
// @desc    Restore deactivated category
// @access  Private
router.post('/:id/restore', auth, checkOwnership(Category), async (req, res) => {
  try {
    if (req.resource.isActive) {
      return res.status(400).json({
        message: 'Category is already active'
      });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).populate('parent', 'name color icon');

    res.json({
      message: 'Category restored successfully',
      category
    });

  } catch (error) {
    console.error('Restore category error:', error);
    res.status(500).json({
      message: 'Server error restoring category'
    });
  }
});

// @route   POST /api/categories/reorder
// @desc    Reorder categories
// @access  Private
router.post('/reorder', [
  body('categories')
    .isArray({ min: 1 })
    .withMessage('Categories array is required'),
  body('categories.*.id')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('categories.*.order')
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { categories } = req.body;

    // Verify all categories belong to the user
    const categoryIds = categories.map(cat => cat.id);
    const userCategories = await Category.find({
      _id: { $in: categoryIds },
      user: req.user._id
    });

    if (userCategories.length !== categories.length) {
      return res.status(400).json({
        message: 'Some categories do not belong to user'
      });
    }

    // Update order for each category
    const updatePromises = categories.map(cat =>
      Category.findByIdAndUpdate(cat.id, { order: cat.order })
    );

    await Promise.all(updatePromises);

    res.json({
      message: 'Categories reordered successfully'
    });

  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({
      message: 'Server error reordering categories'
    });
  }
});

// @route   GET /api/categories/analytics/usage
// @desc    Get category usage analytics
// @access  Private
router.get('/analytics/usage', auth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const analytics = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate }
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
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          categoryName: { $first: '$categoryName' },
          categoryColor: { $first: '$categoryColor' },
          categoryIcon: { $first: '$categoryIcon' },
          totalAmount: { $sum: '$total' },
          totalTransactions: { $sum: '$count' },
          byType: {
            $push: {
              type: '$_id.type',
              total: '$total',
              count: '$count',
              avgAmount: '$avgAmount'
            }
          }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    res.json({
      message: 'Category usage analytics retrieved successfully',
      period,
      analytics
    });

  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({
      message: 'Server error retrieving category analytics'
    });
  }
});

module.exports = router;