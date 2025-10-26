const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkBudgetCategories = async () => {
  try {
    // Find the user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Get all budgets for this user
    const budgets = await Budget.find({ user: user._id })
      .populate('categories.category')
      .sort({ createdAt: -1 });

    console.log(`\nBudgets count: ${budgets.length}`);

    if (budgets.length > 0) {
      console.log('\nBudget details:');
      budgets.forEach((budget, index) => {
        console.log(`\n${index + 1}. Budget: ${budget.name}`);
        console.log(`   Period: ${budget.period}`);
        console.log(`   Total Budget: ${budget.totalBudget}`);
        console.log(`   Categories (${budget.categories.length}):`);
        
        budget.categories.forEach((cat, catIndex) => {
          console.log(`     ${catIndex + 1}. ${cat.category?.name || 'Unknown'} - $${cat.budgetAmount} (ID: ${cat.category?._id || 'N/A'})`);
        });

        // Calculate total budget amount from categories
        const totalFromCategories = budget.categories.reduce((sum, cat) => sum + (cat.budgetAmount || 0), 0);
        console.log(`   Total from categories: $${totalFromCategories}`);
      });

      // Check transactions for each budget category
      console.log('\n=== TRANSACTION MATCHING TEST ===');
      
      for (const budget of budgets) {
        console.log(`\nBudget: ${budget.name}`);
        
        // Get category IDs from this budget
        const budgetCategoryIds = budget.categories
          .map(cat => cat.category?._id?.toString())
          .filter(id => id);
        
        console.log(`Budget category IDs: [${budgetCategoryIds.join(', ')}]`);
        
        // Find transactions for these categories
        const transactions = await Transaction.find({
          user: user._id,
          type: 'expense',
          category: { $in: budgetCategoryIds }
        }).populate('category');
        
        console.log(`Matching transactions: ${transactions.length}`);
        
        if (transactions.length > 0) {
          console.log('Sample transactions:');
          transactions.slice(0, 3).forEach((txn, idx) => {
            console.log(`  ${idx + 1}. ${txn.title} - $${txn.amount} - ${txn.category?.name}`);
          });
        }
        
        // Calculate spent amount
        const spentAmount = transactions.reduce((sum, txn) => sum + txn.amount, 0);
        console.log(`Total spent: $${spentAmount}`);
      }
    }

  } catch (error) {
    console.error('Error checking budget categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

connectDB().then(() => {
  checkBudgetCategories();
});