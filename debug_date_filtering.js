const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

// Import models
const Transaction = require('./backend/models/Transaction');
const User = require('./backend/models/User');

async function debugDateFiltering() {
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

    // Get all completed income transactions
    const incomeTransactions = await Transaction.find({ 
      user: user._id,
      type: 'income',
      status: 'completed'
    }).populate('category', 'name type').sort({ date: -1 });
    
    console.log(`\nCompleted Income Transactions: ${incomeTransactions.length}`);
    
    // Show all income transactions with dates
    console.log('\n=== COMPLETED INCOME TRANSACTIONS ===');
    incomeTransactions.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.title} | Amount: $${txn.amount} | Date: ${txn.date.toISOString()} | Category: ${txn.category?.name || 'None'}`);
    });

    // Check current month filtering (November 2024)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    console.log(`\n=== CURRENT MONTH FILTER ===`);
    console.log(`Current Date: ${now.toISOString()}`);
    console.log(`Start of Month: ${startOfMonth.toISOString()}`);
    console.log(`End of Month: ${endOfMonth.toISOString()}`);
    
    const currentMonthIncome = incomeTransactions.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate >= startOfMonth && txnDate <= endOfMonth;
    });
    
    console.log(`\nIncome transactions in current month: ${currentMonthIncome.length}`);
    currentMonthIncome.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.title} | Amount: $${txn.amount} | Date: ${txn.date.toISOString()}`);
    });
    
    const currentMonthIncomeTotal = currentMonthIncome.reduce((sum, t) => sum + t.amount, 0);
    console.log(`Total current month income: $${currentMonthIncomeTotal}`);

    // Check October 2025 (where most income transactions are)
    const oct2025Start = new Date(2025, 9, 1); // October is month 9 (0-indexed)
    const oct2025End = new Date(2025, 9, 31);
    
    console.log(`\n=== OCTOBER 2025 FILTER ===`);
    console.log(`October 2025 Start: ${oct2025Start.toISOString()}`);
    console.log(`October 2025 End: ${oct2025End.toISOString()}`);
    
    const oct2025Income = incomeTransactions.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate >= oct2025Start && txnDate <= oct2025End;
    });
    
    console.log(`\nIncome transactions in October 2025: ${oct2025Income.length}`);
    oct2025Income.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.title} | Amount: $${txn.amount} | Date: ${txn.date.toISOString()}`);
    });
    
    const oct2025IncomeTotal = oct2025Income.reduce((sum, t) => sum + t.amount, 0);
    console.log(`Total October 2025 income: $${oct2025IncomeTotal}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugDateFiltering();