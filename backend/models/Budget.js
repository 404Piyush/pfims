const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true,
    maxlength: [100, 'Budget name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  categories: [{
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    budgetAmount: {
      type: Number,
      required: true,
      min: [0, 'Budget amount must be positive']
    },
    spentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Spent amount cannot be negative']
    },
    alertThreshold: {
      type: Number,
      min: [0, 'Alert threshold must be between 0 and 100'],
      max: [100, 'Alert threshold must be between 0 and 100'],
      default: 80
    }
  }],
  period: {
    type: String,
    required: true,
    enum: {
      values: ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      message: 'Period must be weekly, monthly, quarterly, yearly, or custom'
    }
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  totalBudget: {
    type: Number,
    required: true,
    min: [0, 'Total budget must be positive']
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    thresholdAlerts: {
      type: Boolean,
      default: true
    },
    overBudgetAlerts: {
      type: Boolean,
      default: true
    }
  },
  rollover: {
    enabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      enum: ['surplus', 'deficit', 'both'],
      default: 'surplus'
    }
  }
}, {
  timestamps: true
});

// Compound indexes
budgetSchema.index({ user: 1, isActive: 1, startDate: -1 });
budgetSchema.index({ user: 1, endDate: 1 });

// Validation: endDate must be after startDate
budgetSchema.pre('validate', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    const error = new Error('End date must be after start date');
    return next(error);
  }

  this.totalBudget = Array.isArray(this.categories)
    ? this.categories.reduce((total, cat) => total + (cat.budgetAmount || 0), 0)
    : 0;

  next();
});

// Virtual for budget utilization percentage
budgetSchema.virtual('utilizationPercentage').get(function() {
  if (this.totalBudget === 0) return 0;
  return Math.round((this.totalSpent / this.totalBudget) * 100);
});

// Virtual for remaining budget
budgetSchema.virtual('remainingBudget').get(function() {
  return Math.max(0, this.totalBudget - this.totalSpent);
});

// Virtual for days remaining
budgetSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = new Date(this.endDate);
  const diffTime = endDate - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Virtual for budget status
budgetSchema.virtual('status').get(function() {
  const now = new Date();
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  
  if (now < startDate) return 'upcoming';
  if (now > endDate) return 'expired';
  if (this.totalSpent > this.totalBudget) return 'over_budget';
  if (this.utilizationPercentage >= 80) return 'warning';
  return 'on_track';
});

// Method to update spent amounts
budgetSchema.methods.updateSpentAmounts = async function() {
  const Transaction = mongoose.model('Transaction');

  const categoryIds = (Array.isArray(this.categories) ? this.categories : [])
    .map(cat => (cat?.category?._id ? cat.category._id : cat?.category))
    .filter(Boolean);

  const spendingByCategory = categoryIds.length
    ? await Transaction.aggregate([
        {
          $match: {
            user: this.user,
            type: 'expense',
            status: 'completed',
            category: { $in: categoryIds },
            date: { $gte: this.startDate, $lte: this.endDate }
          }
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' }
          }
        }
      ])
    : [];

  const totalsById = new Map(
    spendingByCategory.map(row => [row._id.toString(), row.total || 0])
  );

  let totalSpent = 0;
  (Array.isArray(this.categories) ? this.categories : []).forEach(cat => {
    const categoryId = cat?.category?._id ? cat.category._id : cat?.category;
    const spentAmount = categoryId ? (totalsById.get(categoryId.toString()) || 0) : 0;
    cat.spentAmount = spentAmount;
    totalSpent += spentAmount;
  });

  this.totalSpent = totalSpent;

  return this.save();
};

// Static method to get active budgets for user
budgetSchema.statics.getActiveBudgets = async function(userId) {
  const now = new Date();
  return await this.find({
    user: userId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).populate('categories.category');
};

// Static method to create budget from template
budgetSchema.statics.createFromTemplate = async function(userId, templateData, startDate, endDate) {
  const budget = new this({
    user: userId,
    name: templateData.name,
    description: templateData.description,
    categories: templateData.categories,
    period: templateData.period,
    startDate: startDate,
    endDate: endDate,
    currency: templateData.currency || 'USD'
  });
  
  return await budget.save();
};

module.exports = mongoose.model('Budget', budgetSchema);
