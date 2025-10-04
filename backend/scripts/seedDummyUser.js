const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const seedDummyUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'jane.smith@test.com' });
    if (existingUser) {
      console.log('User jane.smith@test.com already exists');
      return;
    }

    // Create user
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = new User({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@test.com',
      password: hashedPassword,
      isEmailVerified: true,
      preferences: {
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        theme: 'light'
      }
    });

    await user.save();
    console.log('Created user:', user.email);

    // Create default categories
    const categories = await Category.createDefaultCategories(user._id);
    console.log(`Created ${categories.length} default categories`);

    // Create some sample transactions
    const sampleTransactions = [
      // Income transactions
      {
        user: user._id,
        category: categories.find(c => c.name === 'Salary')._id,
        type: 'income',
        amount: 5000,
        description: 'Monthly salary',
        date: new Date('2024-01-01'),
        tags: ['salary', 'monthly']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Freelance')._id,
        type: 'income',
        amount: 1200,
        description: 'Web development project',
        date: new Date('2024-01-15'),
        tags: ['freelance', 'web-dev']
      },
      // Expense transactions
      {
        user: user._id,
        category: categories.find(c => c.name === 'Food & Dining')._id,
        type: 'expense',
        amount: 45.50,
        description: 'Grocery shopping',
        date: new Date('2024-01-02'),
        tags: ['groceries', 'food']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Transportation')._id,
        type: 'expense',
        amount: 25.00,
        description: 'Gas station',
        date: new Date('2024-01-03'),
        tags: ['gas', 'car']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Entertainment')._id,
        type: 'expense',
        amount: 15.99,
        description: 'Netflix subscription',
        date: new Date('2024-01-05'),
        tags: ['streaming', 'subscription']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Bills & Utilities')._id,
        type: 'expense',
        amount: 120.00,
        description: 'Electricity bill',
        date: new Date('2024-01-10'),
        tags: ['utilities', 'electricity']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Shopping')._id,
        type: 'expense',
        amount: 89.99,
        description: 'Online shopping - clothes',
        date: new Date('2024-01-12'),
        tags: ['clothes', 'online']
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Healthcare')._id,
        type: 'expense',
        amount: 75.00,
        description: 'Doctor visit',
        date: new Date('2024-01-18'),
        tags: ['medical', 'checkup']
      }
    ];

    await Transaction.insertMany(sampleTransactions);
    console.log(`Created ${sampleTransactions.length} sample transactions`);

    console.log('\nDummy data created successfully!');
    console.log('Login credentials:');
    console.log('Email: jane.smith@test.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error seeding dummy user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
seedDummyUser();