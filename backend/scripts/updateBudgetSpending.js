const mongoose = require('mongoose');
const User = require('../models/User');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pfims', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateBudgetSpending() {
  try {
    console.log('🔄 Updating budget spending for piyush@gmail.com...\n');

    // Find the user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('❌ User piyush@gmail.com not found!');
      return;
    }
    console.log('✅ User found:', user.email);

    // Find all budgets for the user
    const budgets = await Budget.find({ user: user._id }).populate('categories.category');
    console.log(`📊 Found ${budgets.length} budgets to update\n`);

    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i];
      console.log(`Updating budget ${i + 1}: ${budget.name}`);
      console.log(`  Period: ${budget.startDate.toDateString()} to ${budget.endDate.toDateString()}`);
      console.log(`  Before update - Total spent: $${budget.totalSpent}`);
      
      // Update spent amounts using the model method
      await budget.updateSpentAmounts();
      
      // Reload the budget to see updated values
      const updatedBudget = await Budget.findById(budget._id).populate('categories.category');
      console.log(`  After update - Total spent: $${updatedBudget.totalSpent}`);
      
      // Show category breakdown
      updatedBudget.categories.forEach((cat, index) => {
        console.log(`    ${cat.category.name}: $${cat.spentAmount} / $${cat.budgetAmount}`);
      });
      
      console.log('');
    }

    console.log('✅ Budget spending update complete!');

  } catch (error) {
    console.error('❌ Error updating budget spending:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateBudgetSpending();