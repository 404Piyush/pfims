const mongoose = require('mongoose');
const User = require('../models/User');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pfims', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkPiyushData() {
  try {
    console.log('🔍 Checking data for piyush@gmail.com...\n');

    // Find the user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('❌ User piyush@gmail.com not found!');
      return;
    }
    console.log('✅ User found:', user.email);
    console.log('   User ID:', user._id);
    console.log('   Name:', user.name);
    console.log('');

    // Check budgets
    const budgets = await Budget.find({ user: user._id }).populate('categories.category');
    console.log('💰 Budgets found:', budgets.length);
    if (budgets.length > 0) {
      budgets.forEach((budget, index) => {
        console.log(`   Budget ${index + 1}:`);
        console.log(`     Name: ${budget.name}`);
        console.log(`     Period: ${budget.period}`);
        console.log(`     Start Date: ${budget.startDate}`);
        console.log(`     End Date: ${budget.endDate}`);
        console.log(`     Total Budget: $${budget.totalBudget}`);
        console.log(`     Total Spent: $${budget.totalSpent}`);
        console.log(`     Active: ${budget.isActive}`);
        console.log(`     Categories: ${budget.categories.length}`);
        budget.categories.forEach((cat, catIndex) => {
          console.log(`       ${catIndex + 1}. ${cat.category?.name || 'Unknown'}: $${cat.budgetAmount} (spent: $${cat.spentAmount})`);
        });
        console.log('');
      });
    } else {
      console.log('   ❌ No budgets found for this user');
    }

    // Check transactions
    const transactions = await Transaction.find({ user: user._id }).populate('category');
    console.log('💳 Transactions found:', transactions.length);
    if (transactions.length > 0) {
      console.log('   Recent transactions:');
      const recentTransactions = transactions.slice(-5);
      recentTransactions.forEach((transaction, index) => {
        console.log(`     ${index + 1}. ${transaction.title}: $${transaction.amount} (${transaction.type}) - ${transaction.category?.name || 'No category'}`);
      });
      
      // Group by month
      const transactionsByMonth = {};
      transactions.forEach(t => {
        const month = t.date.toISOString().substring(0, 7);
        if (!transactionsByMonth[month]) {
          transactionsByMonth[month] = { count: 0, total: 0 };
        }
        transactionsByMonth[month].count++;
        transactionsByMonth[month].total += t.amount;
      });
      
      console.log('\n   Transactions by month:');
      Object.entries(transactionsByMonth).forEach(([month, data]) => {
        console.log(`     ${month}: ${data.count} transactions, $${data.total.toFixed(2)} total`);
      });
    } else {
      console.log('   ❌ No transactions found for this user');
    }

    // Check categories
    const categories = await Category.find({ user: user._id });
    console.log('\n📂 Categories found:', categories.length);
    if (categories.length > 0) {
      categories.forEach((category, index) => {
        console.log(`   ${index + 1}. ${category.name} (${category.type}) - ${category.transactionCount || 0} transactions`);
      });
    } else {
      console.log('   ❌ No categories found for this user');
    }

    console.log('\n✅ Data check complete!');

  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkPiyushData();