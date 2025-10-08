const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const seedPiyushUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Check if user already exists
    let user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      // Create user
      const hashedPassword = await bcrypt.hash('password123', 12);
      user = new User({
        firstName: 'Piyush',
        lastName: 'Utkar',
        email: 'piyush@gmail.com',
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
    } else {
      console.log('User piyush@gmail.com already exists');
    }

    // Check if categories exist, if not create them
    let categories = await Category.find({ user: user._id });
    if (categories.length === 0) {
      categories = await Category.createDefaultCategories(user._id);
      console.log(`Created ${categories.length} default categories`);
    } else {
      console.log(`Found ${categories.length} existing categories`);
    }

    // Delete existing transactions for clean slate
    await Transaction.deleteMany({ user: user._id });
    console.log('Cleared existing transactions');

    // Create comprehensive sample transactions for the last 3 months
    const now = new Date();
    const sampleTransactions = [];

    // Helper function to get random date in the last 90 days
    const getRandomDate = (daysBack) => {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
      return date;
    };

    // Income transactions
    const incomeTransactions = [
      {
        user: user._id,
        category: categories.find(c => c.name === 'Salary')?._id,
        type: 'income',
        amount: 8500,
        title: 'Monthly Salary - December',
        description: 'Software Engineer Salary',
        account: 'Main Checking',
        date: new Date('2024-12-01'),
        tags: ['salary', 'monthly'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Salary')?._id,
        type: 'income',
        amount: 8500,
        title: 'Monthly Salary - November',
        description: 'Software Engineer Salary',
        account: 'Main Checking',
        date: new Date('2024-11-01'),
        tags: ['salary', 'monthly'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Freelance')?._id,
        type: 'income',
        amount: 2500,
        title: 'Freelance Web Project',
        description: 'E-commerce website development',
        account: 'Main Checking',
        date: getRandomDate(30),
        tags: ['freelance', 'web-dev', 'project'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Investment')?._id,
        type: 'income',
        amount: 450,
        title: 'Stock Dividends',
        description: 'Quarterly dividend payment',
        account: 'Investment Account',
        date: getRandomDate(45),
        tags: ['dividends', 'stocks'],
        paymentMethod: 'bank_transfer'
      }
    ];

    // Expense transactions
    const expenseTransactions = [
      // Food & Dining
      {
        user: user._id,
        category: categories.find(c => c.name === 'Food & Dining')?._id,
        type: 'expense',
        amount: 125.50,
        title: 'Weekly Groceries',
        description: 'Whole Foods grocery shopping',
        account: 'Main Checking',
        date: getRandomDate(7),
        tags: ['groceries', 'food', 'weekly'],
        paymentMethod: 'debit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Food & Dining')?._id,
        type: 'expense',
        amount: 45.75,
        title: 'Restaurant Dinner',
        description: 'Italian restaurant with friends',
        account: 'Main Checking',
        date: getRandomDate(14),
        tags: ['restaurant', 'dinner', 'social'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Food & Dining')?._id,
        type: 'expense',
        amount: 12.50,
        title: 'Coffee Shop',
        description: 'Morning coffee and pastry',
        account: 'Main Checking',
        date: getRandomDate(3),
        tags: ['coffee', 'breakfast'],
        paymentMethod: 'credit_card'
      },

      // Transportation
      {
        user: user._id,
        category: categories.find(c => c.name === 'Transportation')?._id,
        type: 'expense',
        amount: 65.00,
        title: 'Gas Station',
        description: 'Fill up car tank',
        account: 'Main Checking',
        date: getRandomDate(10),
        tags: ['gas', 'car', 'fuel'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Transportation')?._id,
        type: 'expense',
        amount: 25.50,
        title: 'Uber Ride',
        description: 'Ride to airport',
        account: 'Main Checking',
        date: getRandomDate(20),
        tags: ['uber', 'airport', 'travel'],
        paymentMethod: 'credit_card'
      },

      // Bills & Utilities
      {
        user: user._id,
        category: categories.find(c => c.name === 'Bills & Utilities')?._id,
        type: 'expense',
        amount: 145.00,
        title: 'Electricity Bill',
        description: 'Monthly electricity bill',
        account: 'Main Checking',
        date: new Date('2024-12-15'),
        tags: ['utilities', 'electricity', 'monthly'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Bills & Utilities')?._id,
        type: 'expense',
        amount: 89.99,
        title: 'Internet Bill',
        description: 'High-speed internet monthly',
        account: 'Main Checking',
        date: new Date('2024-12-10'),
        tags: ['internet', 'utilities', 'monthly'],
        paymentMethod: 'bank_transfer'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Bills & Utilities')?._id,
        type: 'expense',
        amount: 55.00,
        title: 'Phone Bill',
        description: 'Mobile phone monthly plan',
        account: 'Main Checking',
        date: new Date('2024-12-05'),
        tags: ['phone', 'mobile', 'monthly'],
        paymentMethod: 'bank_transfer'
      },

      // Entertainment
      {
        user: user._id,
        category: categories.find(c => c.name === 'Entertainment')?._id,
        type: 'expense',
        amount: 15.99,
        title: 'Netflix Subscription',
        description: 'Monthly streaming service',
        account: 'Main Checking',
        date: new Date('2024-12-01'),
        tags: ['streaming', 'netflix', 'subscription'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Entertainment')?._id,
        type: 'expense',
        amount: 35.00,
        title: 'Movie Theater',
        description: 'Movie tickets and popcorn',
        account: 'Main Checking',
        date: getRandomDate(15),
        tags: ['movies', 'theater', 'entertainment'],
        paymentMethod: 'credit_card'
      },

      // Shopping
      {
        user: user._id,
        category: categories.find(c => c.name === 'Shopping')?._id,
        type: 'expense',
        amount: 189.99,
        title: 'Amazon Purchase',
        description: 'Electronics and books',
        account: 'Main Checking',
        date: getRandomDate(25),
        tags: ['amazon', 'electronics', 'books'],
        paymentMethod: 'credit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Shopping')?._id,
        type: 'expense',
        amount: 75.50,
        title: 'Clothing Store',
        description: 'Winter jacket',
        account: 'Main Checking',
        date: getRandomDate(35),
        tags: ['clothes', 'winter', 'jacket'],
        paymentMethod: 'debit_card'
      },

      // Healthcare
      {
        user: user._id,
        category: categories.find(c => c.name === 'Healthcare')?._id,
        type: 'expense',
        amount: 125.00,
        title: 'Doctor Visit',
        description: 'Annual checkup',
        account: 'Main Checking',
        date: getRandomDate(60),
        tags: ['doctor', 'checkup', 'health'],
        paymentMethod: 'debit_card'
      },
      {
        user: user._id,
        category: categories.find(c => c.name === 'Healthcare')?._id,
        type: 'expense',
        amount: 25.99,
        title: 'Pharmacy',
        description: 'Prescription medication',
        account: 'Main Checking',
        date: getRandomDate(30),
        tags: ['pharmacy', 'medication', 'prescription'],
        paymentMethod: 'debit_card'
      }
    ];

    // Combine all transactions
    sampleTransactions.push(...incomeTransactions, ...expenseTransactions);

    // Filter out transactions with undefined categories
    const validTransactions = sampleTransactions.filter(t => t.category);

    await Transaction.insertMany(validTransactions);
    console.log(`Created ${validTransactions.length} sample transactions`);

    console.log('\nPiyush user data created successfully!');
    console.log('Login credentials:');
    console.log('Email: piyush@gmail.com');
    console.log('Password: password123');

    // Show summary
    const totalIncome = validTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = validTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    console.log('\nTransaction Summary:');
    console.log(`Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`Net: $${(totalIncome - totalExpenses).toFixed(2)}`);

  } catch (error) {
    console.error('Error seeding Piyush user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
seedPiyushUser();