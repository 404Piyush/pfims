const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const checkDummyUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'jane.smith@test.com' });
    if (!user) {
      console.log('User jane.smith@test.com not found');
      return;
    }

    console.log('User found:');
    console.log('- Name:', user.firstName, user.lastName);
    console.log('- Email:', user.email);
    console.log('- Email Verified:', user.isEmailVerified);
    console.log('- Created:', user.createdAt);

    // Check categories
    const categories = await Category.find({ user: user._id });
    console.log(`\nCategories: ${categories.length} found`);
    categories.forEach(cat => {
      console.log(`- ${cat.name} (${cat.type})`);
    });

    // Check transactions
    const transactions = await Transaction.find({ user: user._id }).populate('category');
    console.log(`\nTransactions: ${transactions.length} found`);
    transactions.forEach(trans => {
      console.log(`- ${trans.date.toDateString()}: ${trans.type} $${trans.amount} - ${trans.description} (${trans.category?.name})`);
    });

    console.log('\nLogin credentials:');
    console.log('Email: jane.smith@test.com');
    console.log('Password: password123 (if not changed)');

  } catch (error) {
    console.error('Error checking dummy user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the check function
checkDummyUser();