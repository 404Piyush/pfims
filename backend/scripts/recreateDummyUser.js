const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const recreateDummyUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Delete existing dummy user and related data
    const existingUser = await User.findOne({ email: 'jane.smith@test.com' });
    if (existingUser) {
      console.log('Deleting existing dummy user and related data...');
      
      // Delete transactions
      await Transaction.deleteMany({ userId: existingUser._id });
      console.log('Deleted transactions');
      
      // Delete categories
      await Category.deleteMany({ userId: existingUser._id });
      console.log('Deleted categories');
      
      // Delete user
      await User.deleteOne({ _id: existingUser._id });
      console.log('Deleted user');
    }

    // Create new dummy user
    console.log('Creating new dummy user...');
    const newUser = new User({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@test.com',
      password: 'password123',
      currency: 'USD',
      timezone: 'America/New_York',
      isEmailVerified: true,
      isActive: true
    });

    await newUser.save();
    console.log('New dummy user created successfully');

    // Test the password
    const testUser = await User.findOne({ email: 'jane.smith@test.com' }).select('+password');
    const isMatch = await testUser.comparePassword('password123');
    console.log('Password verification test:', isMatch);

    // Create default categories
    const categories = [
      { name: 'Food & Dining', type: 'expense', color: '#FF6B6B', user: testUser._id },
      { name: 'Transportation', type: 'expense', color: '#4ECDC4', user: testUser._id },
      { name: 'Shopping', type: 'expense', color: '#45B7D1', user: testUser._id },
      { name: 'Entertainment', type: 'expense', color: '#96CEB4', user: testUser._id },
      { name: 'Bills & Utilities', type: 'expense', color: '#FFEAA7', user: testUser._id },
      { name: 'Healthcare', type: 'expense', color: '#DDA0DD', user: testUser._id },
      { name: 'Salary', type: 'income', color: '#98D8C8', user: testUser._id },
      { name: 'Freelance', type: 'income', color: '#F7DC6F', user: testUser._id },
      { name: 'Investment', type: 'income', color: '#BB8FCE', user: testUser._id }
    ];

    await Category.insertMany(categories);
    console.log('Default categories created');

    // Create sample transactions
    const createdCategories = await Category.find({ user: testUser._id });
    const foodCategory = createdCategories.find(cat => cat.name === 'Food & Dining');
    const salaryCategory = createdCategories.find(cat => cat.name === 'Salary');
    const transportCategory = createdCategories.find(cat => cat.name === 'Transportation');

    const transactions = [
      {
        user: testUser._id,
        category: salaryCategory._id,
        type: 'income',
        amount: 5000,
        title: 'Monthly Salary',
        description: 'Monthly Salary',
        account: 'Main Account',
        date: new Date('2024-01-01'),
        tags: ['salary', 'monthly']
      },
      {
        user: testUser._id,
        category: foodCategory._id,
        type: 'expense',
        amount: 45.50,
        title: 'Grocery Shopping',
        description: 'Grocery Shopping',
        account: 'Main Account',
        date: new Date('2024-01-02'),
        tags: ['groceries', 'food']
      },
      {
        user: testUser._id,
        category: transportCategory._id,
        type: 'expense',
        amount: 12.75,
        title: 'Bus Fare',
        description: 'Bus Fare',
        account: 'Main Account',
        date: new Date('2024-01-03'),
        tags: ['transport', 'bus']
      }
    ];

    await Transaction.insertMany(transactions);
    console.log('Sample transactions created');

    console.log('\nDummy user recreation completed successfully!');
    console.log('Email: jane.smith@test.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

recreateDummyUser();