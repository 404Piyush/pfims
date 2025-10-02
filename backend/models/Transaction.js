const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Transaction title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['income', 'expense', 'transfer'],
      message: 'Type must be either income, expense, or transfer'
    },
    index: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  account: {
    type: String,
    required: [true, 'Account is required'],
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'digital_wallet', 'other'],
    default: 'cash'
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
  },
  exchangeRate: {
    type: Number,
    default: 1,
    min: [0.0001, 'Exchange rate must be positive']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  receipt: {
    filename: String,
    url: String,
    uploadDate: Date
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      min: 1
    },
    endDate: Date,
    nextDue: Date
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed',
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });
transactionSchema.index({ user: 1, status: 1, date: -1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Pre-save middleware to handle recurring transactions
transactionSchema.pre('save', function(next) {
  if (this.isRecurring && this.recurringPattern.frequency && !this.recurringPattern.nextDue) {
    const nextDue = new Date(this.date);
    
    switch (this.recurringPattern.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + (this.recurringPattern.interval || 1));
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + (7 * (this.recurringPattern.interval || 1)));
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + (this.recurringPattern.interval || 1));
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + (this.recurringPattern.interval || 1));
        break;
    }
    
    this.recurringPattern.nextDue = nextDue;
  }
  next();
});

// Static method to get user's transaction summary
transactionSchema.statics.getUserSummary = async function(userId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('Transaction', transactionSchema);