const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
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

const checkIncomeTransactions = async () => {
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

    // Get all transactions for this user
    const allTransactions = await Transaction.find({ user: user._id })
      .populate('category')
      .sort({ date: -1 });

    console.log(`\nTotal transactions: ${allTransactions.length}`);

    // Separate by type
    const incomeTransactions = allTransactions.filter(t => t.type === 'income');
    const expenseTransactions = allTransactions.filter(t => t.type === 'expense');

    console.log(`Income transactions: ${incomeTransactions.length}`);
    console.log(`Expense transactions: ${expenseTransactions.length}`);

    // Calculate totals
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    console.log(`\nTotal Income: $${totalIncome}`);
    console.log(`Total Expenses: $${totalExpenses}`);
    console.log(`Net Amount: $${totalIncome - totalExpenses}`);

    // Show income transactions if any
    if (incomeTransactions.length > 0) {
      console.log('\n=== INCOME TRANSACTIONS ===');
      incomeTransactions.forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.title} - $${transaction.amount} - ${transaction.category?.name || 'No Category'} - ${new Date(transaction.date).toDateString()}`);
      });
    } else {
      console.log('\n❌ NO INCOME TRANSACTIONS FOUND');
    }

    // Show first 10 expense transactions
    if (expenseTransactions.length > 0) {
      console.log('\n=== FIRST 10 EXPENSE TRANSACTIONS ===');
      expenseTransactions.slice(0, 10).forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.title} - $${transaction.amount} - ${transaction.category?.name || 'No Category'} - ${new Date(transaction.date).toDateString()}`);
      });
    }

    // Check categories
    const incomeCategories = await Category.find({ user: user._id, type: 'income' });
    const expenseCategories = await Category.find({ user: user._id, type: 'expense' });

    console.log(`\nIncome categories: ${incomeCategories.length}`);
    console.log(`Expense categories: ${expenseCategories.length}`);

    if (incomeCategories.length > 0) {
      console.log('\nIncome categories:');
      incomeCategories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.name} (ID: ${cat._id})`);
      });
    }

  } catch (error) {
    console.error('Error checking income transactions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

connectDB().then(() => {
  checkIncomeTransactions();
});