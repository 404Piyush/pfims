const mongoose = require('mongoose');

/**
 * Query optimization utilities
 */
class QueryOptimizer {
  /**
   * Build optimized aggregation pipeline for transaction analytics
   */
  static buildTransactionAnalyticsPipeline(userId, filters = {}) {
    const pipeline = [
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          ...filters
        }
      }
    ];

    // Add status filter only if explicitly provided
    if (filters.status) {
      pipeline[0].$match.status = filters.status;
    }

    // Add date filtering if provided
    if (filters.startDate || filters.endDate) {
      const dateMatch = {};
      if (filters.startDate) dateMatch.$gte = new Date(filters.startDate);
      if (filters.endDate) dateMatch.$lte = new Date(filters.endDate);
      pipeline[0].$match.date = dateMatch;
    }

    return pipeline;
  }

  /**
   * Build optimized query for transactions with pagination
   */
  static buildTransactionQuery(userId, filters = {}) {
    const query = {
      user: userId
    };

    // Add filters
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status; // Only add status if explicitly provided
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) query.date.$lte = new Date(filters.endDate);
    }
    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = parseFloat(filters.minAmount);
      if (filters.maxAmount) query.amount.$lte = parseFloat(filters.maxAmount);
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    return query;
  }

  /**
   * Build optimized sort options
   */
  static buildSortOptions(sortBy = 'date', sortOrder = 'desc') {
    const validSortFields = ['date', 'amount', 'title', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'date';
    const order = sortOrder === 'asc' ? 1 : -1;
    
    return { [field]: order };
  }

  /**
   * Build budget aggregation pipeline
   */
  static buildBudgetAnalyticsPipeline(userId, period = 'month') {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return [
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          isActive: true,
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categories.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $addFields: {
          utilizationPercentage: {
            $multiply: [
              { $divide: ['$totalSpent', '$totalBudget'] },
              100
            ]
          },
          remainingBudget: { $subtract: ['$totalBudget', '$totalSpent'] }
        }
      }
    ];
  }

  /**
   * Optimize query with lean and select
   */
  static optimizeQuery(query, options = {}) {
    if (options.lean !== false) {
      query = query.lean();
    }

    if (options.select) {
      query = query.select(options.select);
    }

    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(pop => query = query.populate(pop));
      } else {
        query = query.populate(options.populate);
      }
    }

    return query;
  }

  /**
   * Build category tree query
   */
  static buildCategoryTreePipeline(userId, type = null) {
    const matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      isActive: true
    };

    if (type && type !== 'both') {
      matchStage.$or = [{ type: type }, { type: 'both' }];
    }

    return [
      { $match: matchStage },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: 'parent',
          as: 'children'
        }
      },
      {
        $addFields: {
          hasChildren: { $gt: [{ $size: '$children' }, 0] }
        }
      },
      { $sort: { order: 1, name: 1 } }
    ];
  }

  /**
   * Cache key generator for queries
   */
  static generateCacheKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    return `${prefix}:${Buffer.from(JSON.stringify(sortedParams)).toString('base64')}`;
  }

  /**
   * Build budget query with filters
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} MongoDB query object
   */
  static buildBudgetQuery(userId, options = {}) {
    const { status, period, search } = options;
    const filter = { user: userId };
    const now = new Date();

    // Status filtering
    if (status && status !== 'all') {
      switch (status) {
        case 'active':
          filter.isActive = true;
          filter.endDate = { $gte: now };
          break;
        case 'inactive':
          filter.isActive = false;
          break;
        case 'expired':
          filter.endDate = { $lt: now };
          break;
      }
    }

    // Period filtering
    if (period) {
      filter.period = period;
    }

    // Search filtering
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    return filter;
  }

  /**
   * Build category query with filters
   * @param {ObjectId} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} MongoDB query object
   */
  static buildCategoryQuery(userId, options = {}) {
    const { type, includeInactive, search, parent } = options;
    const filter = { user: userId };

    // Type filtering
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Active status filtering
    if (!includeInactive) {
      filter.isActive = true;
    }

    // Parent filtering for subcategories
    if (parent !== undefined) {
      filter.parent = parent === 'null' ? null : parent;
    }

    // Search filtering
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    return filter;
  }

  /**
   * Validate and sanitize MongoDB ObjectId
   */
  static validateObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
  }

  /**
   * Build date range filter
   */
  static buildDateRange(startDate, endDate) {
    const dateFilter = {};
    
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        dateFilter.$gte = start;
      }
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }
    
    return Object.keys(dateFilter).length > 0 ? dateFilter : null;
  }
}

module.exports = QueryOptimizer;