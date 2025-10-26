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

const checkTransactionCategories = async () => {
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
    const transactions = await Transaction.find({ user: user._id })
      .populate('category')
      .sort({ date: -1 })
      .limit(20);

    console.log(`\nTransactions count: ${transactions.length}`);

    // Check category associations
    const transactionsWithCategories = transactions.filter(t => t.category);
    const transactionsWithoutCategories = transactions.filter(t => !t.category);

    console.log(`\nTransactions with categories: ${transactionsWithCategories.length}`);
    console.log(`Transactions without categories: ${transactionsWithoutCategories.length}`);

    if (transactionsWithCategories.length > 0) {
      console.log('\nFirst 10 transactions with categories:');
      transactionsWithCategories.slice(0, 10).forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.title} - $${transaction.amount} (${transaction.type}) - Category: ${transaction.category?.name || 'N/A'} (ID: ${transaction.category?._id || 'N/A'})`);
      });
    }

    if (transactionsWithoutCategories.length > 0) {
      console.log('\nTransactions without categories:');
      transactionsWithoutCategories.slice(0, 5).forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.title} - $${transaction.amount} (${transaction.type}) - No category`);
      });
    }

    // Get all categories for this user
    const categories = await Category.find({ user: user._id });
    console.log(`\nUser categories count: ${categories.length}`);
    
    if (categories.length > 0) {
      console.log('\nUser categories:');
      categories.forEach((category, index) => {
        console.log(`${index + 1}. ${category.name} (${category.type}) - ID: ${category._id}`);
      });
    }

    // Check for expense transactions that match budget categories
    const expenseTransactions = transactions.filter(t => t.type === 'expense' && t.category);
    console.log(`\nExpense transactions with categories: ${expenseTransactions.length}`);

    if (expenseTransactions.length > 0) {
      console.log('\nFirst 5 expense transactions:');
      expenseTransactions.slice(0, 5).forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.title} - $${transaction.amount} - Category: ${transaction.category?.name} (${transaction.category?._id})`);
      });
    }

  } catch (error) {
    console.error('Error checking transaction categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

connectDB().then(() => {
  checkTransactionCategories();
});