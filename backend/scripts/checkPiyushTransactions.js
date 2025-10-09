const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

async function checkPiyushData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');
    
    // Find piyush user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('❌ User piyush@gmail.com not found');
      return;
    }
    
    console.log('✅ User found:', {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified
    });
    
    // Find transactions for this user
    const transactions = await Transaction.find({ user: user._id }).populate('category');
    console.log(`\nTransactions count: ${transactions.length}`);
    
    if (transactions.length > 0) {
      console.log('\nFirst 5 transactions:');
      transactions.slice(0, 5).forEach((txn, index) => {
        console.log(`${index + 1}. ${txn.description} - $${txn.amount} (${txn.type}) - ${txn.date.toDateString()}`);
      });
    } else {
      console.log('❌ No transactions found for this user');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkPiyushData();