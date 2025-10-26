const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

// Import models
const Transaction = require('./backend/models/Transaction');
const User = require('./backend/models/User');

async function debugIncomeIssue() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    console.log(`Found user: ${user.firstName} ${user.lastName}`);

    // Get ALL transactions for this user
    const allTransactions = await Transaction.find({ user: user._id })
      .populate('category', 'name type')
      .sort({ date: -1 });
    
    console.log(`\nTotal transactions: ${allTransactions.length}`);
    
    // Group by type
    const incomeTransactions = allTransactions.filter(t => t.type === 'income');
    const expenseTransactions = allTransactions.filter(t => t.type === 'expense');
    
    console.log(`Income transactions: ${incomeTransactions.length}`);
    console.log(`Expense transactions: ${expenseTransactions.length}`);
    
    // Show all transactions with details
    console.log('\n=== ALL TRANSACTIONS ===');
    allTransactions.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.title} | Type: ${txn.type} | Amount: ₹${txn.amount} | Status: ${txn.status} | Date: ${txn.date.toISOString().split('T')[0]} | Category: ${txn.category?.name || 'None'}`);
    });

    // Calculate totals by type and status
    const completedIncome = allTransactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const completedExpenses = allTransactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`\n=== TOTALS (Completed Only) ===`);
    console.log(`Total Income: ₹${completedIncome}`);
    console.log(`Total Expenses: ₹${completedExpenses}`);
    console.log(`Net Income: ₹${completedIncome - completedExpenses}`);

    // Check current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthlyTransactions = allTransactions.filter(t => {
      const txnDate = new Date(t.date);
      return txnDate >= startOfMonth && txnDate <= endOfMonth;
    });
    
    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = monthlyTransactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`\n=== THIS MONTH (${startOfMonth.toISOString().split('T')[0]} to ${endOfMonth.toISOString().split('T')[0]}) ===`);
    console.log(`Monthly transactions: ${monthlyTransactions.length}`);
    console.log(`Monthly Income: ₹${monthlyIncome}`);
    console.log(`Monthly Expenses: ₹${monthlyExpenses}`);
    console.log(`Monthly Net: ₹${monthlyIncome - monthlyExpenses}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugIncomeIssue();