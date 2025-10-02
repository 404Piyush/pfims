const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['income', 'expense', 'both'],
      message: 'Type must be income, expense, or both'
    },
    index: true
  },
  color: {
    type: String,
    required: true,
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color'],
    default: '#6366f1'
  },
  icon: {
    type: String,
    required: true,
    default: 'folder'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  budget: {
    monthly: {
      type: Number,
      min: 0,
      default: 0
    },
    yearly: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes
categorySchema.index({ user: 1, type: 1, isActive: 1 });
categorySchema.index({ user: 1, parent: 1, order: 1 });

// Prevent circular references
categorySchema.pre('save', async function(next) {
  if (this.parent && this.parent.toString() === this._id.toString()) {
    const error = new Error('Category cannot be its own parent');
    return next(error);
  }
  
  // Check for circular reference in hierarchy
  if (this.parent) {
    let currentParent = await this.constructor.findById(this.parent);
    const visited = new Set([this._id.toString()]);
    
    while (currentParent) {
      if (visited.has(currentParent._id.toString())) {
        const error = new Error('Circular reference detected in category hierarchy');
        return next(error);
      }
      
      visited.add(currentParent._id.toString());
      currentParent = currentParent.parent ? 
        await this.constructor.findById(currentParent.parent) : null;
    }
  }
  
  next();
});

// Virtual for full path
categorySchema.virtual('fullPath').get(function() {
  // This would need to be populated with parent data
  return this.name;
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function(userId, type = null) {
  const match = { user: new mongoose.Types.ObjectId(userId), isActive: true };
  if (type && type !== 'both') {
    match.$or = [{ type: type }, { type: 'both' }];
  }
  
  const categories = await this.find(match).sort({ order: 1, name: 1 });
  
  // Build tree structure
  const categoryMap = new Map();
  const rootCategories = [];
  
  // First pass: create map of all categories
  categories.forEach(cat => {
    categoryMap.set(cat._id.toString(), {
      ...cat.toObject(),
      children: []
    });
  });
  
  // Second pass: build tree
  categories.forEach(cat => {
    const categoryObj = categoryMap.get(cat._id.toString());
    
    if (cat.parent) {
      const parent = categoryMap.get(cat.parent.toString());
      if (parent) {
        parent.children.push(categoryObj);
      } else {
        rootCategories.push(categoryObj);
      }
    } else {
      rootCategories.push(categoryObj);
    }
  });
  
  return rootCategories;
};

// Static method to create default categories
categorySchema.statics.createDefaultCategories = async function(userId) {
  const defaultCategories = [
    // Income categories
    { name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase' },
    { name: 'Freelance', type: 'income', color: '#06b6d4', icon: 'laptop' },
    { name: 'Investment', type: 'income', color: '#8b5cf6', icon: 'trending-up' },
    { name: 'Other Income', type: 'income', color: '#f59e0b', icon: 'plus-circle' },
    
    // Expense categories
    { name: 'Food & Dining', type: 'expense', color: '#ef4444', icon: 'utensils' },
    { name: 'Transportation', type: 'expense', color: '#3b82f6', icon: 'car' },
    { name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag' },
    { name: 'Entertainment', type: 'expense', color: '#f97316', icon: 'film' },
    { name: 'Bills & Utilities', type: 'expense', color: '#6b7280', icon: 'receipt' },
    { name: 'Healthcare', type: 'expense', color: '#dc2626', icon: 'heart' },
    { name: 'Education', type: 'expense', color: '#7c3aed', icon: 'book' },
    { name: 'Travel', type: 'expense', color: '#059669', icon: 'plane' },
    { name: 'Other Expenses', type: 'expense', color: '#64748b', icon: 'more-horizontal' }
  ];
  
  const categories = defaultCategories.map(cat => ({
    ...cat,
    user: userId,
    isDefault: true
  }));
  
  return await this.insertMany(categories);
};

module.exports = mongoose.model('Category', categorySchema);