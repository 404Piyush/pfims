const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const updateDummyUser = async () => {
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

    // Update user to set email verified
    await User.updateOne(
      { email: 'jane.smith@test.com' },
      { isEmailVerified: true }
    );
    console.log('Updated user email verification status to true');

    // Get categories for this user
    const categories = await Category.find({ user: user._id });
    console.log(`Found ${categories.length} categories for user`);

    // Check if transactions already exist
    const existingTransactions = await Transaction.find({ user: user._id });
    if (existingTransactions.length > 0) {
      console.log(`User already has ${existingTransactions.length} transactions`);
      return;
    }

    // Create some sample transactions
    const sampleTransactions = [
      // Income transactions
      {
        user: user._id,
        title: 'Monthly Salary',
        category: categories.find(c => c.name === 'Salary')._id,
        type: 'income',
        amount: 5000,
        account: 'Main Checking',
        description: 'Monthly salary payment',
        date: new Date('2024-01-01'),
        tags: ['salary', 'monthly'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        title: 'Freelance Project',
        category: categories.find(c => c.name === 'Freelance')._id,
        type: 'income',
        amount: 1200,
        account: 'Main Checking',
        description: 'Web development project payment',
        date: new Date('2024-01-15'),
        tags: ['freelance', 'web-dev'],
        paymentMethod: 'bank_transfer'
      },
      // Expense transactions
      {
        user: user._id,
        title: 'Grocery Shopping',
        category: categories.find(c => c.name === 'Food & Dining')._id,
        type: 'expense',
        amount: 45.50,
        account: 'Main Checking',
        description: 'Weekly grocery shopping',
        date: new Date('2024-01-02'),
        tags: ['groceries', 'food'],
        paymentMethod: 'debit_card'
      },
      {
        user: user._id,
        title: 'Gas Station',
        category: categories.find(c => c.name === 'Transportation')._id,
        type: 'expense',
        amount: 25.00,
        account: 'Main Checking',
        description: 'Fuel for car',
        date: new Date('2024-01-03'),
        tags: ['gas', 'car'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        title: 'Netflix Subscription',
        category: categories.find(c => c.name === 'Entertainment')._id,
        type: 'expense',
        amount: 15.99,
        account: 'Main Checking',
        description: 'Monthly streaming subscription',
        date: new Date('2024-01-05'),
        tags: ['streaming', 'subscription'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        title: 'Electricity Bill',
        category: categories.find(c => c.name === 'Bills & Utilities')._id,
        type: 'expense',
        amount: 120.00,
        account: 'Main Checking',
        description: 'Monthly electricity bill',
        date: new Date('2024-01-10'),
        tags: ['utilities', 'electricity'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        title: 'Online Shopping',
        category: categories.find(c => c.name === 'Shopping')._id,
        type: 'expense',
        amount: 89.99,
        account: 'Main Checking',
        description: 'Clothes shopping online',
        date: new Date('2024-01-12'),
        tags: ['clothes', 'online'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        title: 'Doctor Visit',
        category: categories.find(c => c.name === 'Healthcare')._id,
        type: 'expense',
        amount: 75.00,
        account: 'Main Checking',
        description: 'Regular health checkup',
        date: new Date('2024-01-18'),
        tags: ['medical', 'checkup'],
        paymentMethod: 'debit_card'
      }
    ];

    await Transaction.insertMany(sampleTransactions);
    console.log(`Created ${sampleTransactions.length} sample transactions`);

    console.log('\nDummy user updated successfully!');
    console.log('Login credentials:');
    console.log('Email: jane.smith@test.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error updating dummy user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the update function
updateDummyUser();