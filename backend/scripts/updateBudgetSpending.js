const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');
const Budget = require('../models/Budget');

function getArg(name, defaultVal) {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.split('=')[1];
    }
  }
  return defaultVal;
}

async function updateBudgetSpending() {
  try {
    const email = getArg('email', process.env.SEED_EMAIL || 'piyush@gmail.com');
    const budgetId = getArg('budgetId', null);

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    console.log(`\n🔄 Updating budget spending for ${email}...\n`);

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User ${email} not found!`);
      return;
    }
    console.log('✅ User found:', user.email);

    // Find all budgets for the user
    const filter = { user: user._id };
    if (budgetId) filter._id = budgetId;
    const budgets = await Budget.find(filter);
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
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

updateBudgetSpending();
