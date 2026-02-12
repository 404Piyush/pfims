const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
require('dotenv').config();

const checkPiyushUser = async () => {
  try {
    console.log('🔍 Checking piyush@gmail.com user...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    const email = 'piyushutkarxb@gmail.com';
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User piyush@gmail.com not found');
      console.log('✅ This is fine - no transactions to display');
      return;
    }

    console.log('👤 User Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Account Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Last Login: ${user.lastLogin || 'Never'}`);

    // Check transactions for this user
    const transactions = await Transaction.find({ user: user._id }).populate('category');
    
    console.log(`\n💰 Transactions: ${transactions.length} found`);
    
    if (transactions.length > 0) {
      console.log('\n📋 Transaction Summary:');
      transactions.forEach((txn, index) => {
        console.log(`   ${index + 1}. ${txn.title} - $${txn.amount} (${txn.type})`);
      });
      
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      console.log(`\n💵 Total Income: $${totalIncome}`);
      console.log(`💸 Total Expense: $${totalExpense}`);
      console.log(`💰 Net Balance: $${totalIncome - totalExpense}`);
      
      console.log('\n⚠️  User has transactions but they might not be displaying in frontend');
    } else {
      console.log('✅ No transactions found - this explains why nothing is displayed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

checkPiyushUser();