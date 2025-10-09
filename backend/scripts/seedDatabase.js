const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting Database Seeding...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - uncomment if needed)
    // console.log('🧹 Clearing existing data...');
    // await User.deleteMany({});
    // await Category.deleteMany({});
    // await Transaction.deleteMany({});
    // console.log('✅ Existing data cleared');

    // Create sample users
    console.log('\n👥 Creating sample users...');
    
    const sampleUsers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: await bcrypt.hash('Password123!', 12),
        isEmailVerified: true,
        isActive: true,
        preferences: {
          currency: 'USD',
          notifications: {
            email: true,
            push: true,
            transactions: true
          },
          theme: 'light'
        }
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: await bcrypt.hash('Password123!', 12),
        isEmailVerified: true,
        isActive: true,
        preferences: {
          currency: 'EUR',
          notifications: {
            email: true,
            push: false,
            transactions: true
          },
          theme: 'dark'
        }
      }
    ];

    const createdUsers = [];
    for (const userData of sampleUsers) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
          createdUsers.push(existingUser);
        } else {
          const user = new User(userData);
          await user.save();
          console.log(`✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.email})`);
          createdUsers.push(user);
        }
      } catch (error) {
        console.log(`❌ Failed to create user ${userData.email}: ${error.message}`);
      }
    }

    // Create sample categories for each user
    console.log('\n📂 Creating sample categories...');
    
    const categoryTemplates = [
      // Income categories
      { name: 'Salary', type: 'income', color: '#4ECDC4', icon: '💰' },
      { name: 'Freelance', type: 'income', color: '#45B7D1', icon: '💻' },
      { name: 'Investment Returns', type: 'income', color: '#96CEB4', icon: '📈' },
      { name: 'Side Business', type: 'income', color: '#FFEAA7', icon: '🏪' },
      
      // Expense categories
      { name: 'Food & Dining', type: 'expense', color: '#FF6B6B', icon: '🍽️' },
      { name: 'Transportation', type: 'expense', color: '#4ECDC4', icon: '🚗' },
      { name: 'Shopping', type: 'expense', color: '#45B7D1', icon: '🛍️' },
      { name: 'Entertainment', type: 'expense', color: '#96CEB4', icon: '🎬' },
      { name: 'Bills & Utilities', type: 'expense', color: '#FFEAA7', icon: '⚡' },
      { name: 'Healthcare', type: 'expense', color: '#DDA0DD', icon: '🏥' },
      { name: 'Education', type: 'expense', color: '#98D8C8', icon: '📚' },
      { name: 'Travel', type: 'expense', color: '#F7DC6F', icon: '✈️' }
    ];

    const createdCategories = {};
    
    for (const user of createdUsers) {
      createdCategories[user._id] = [];
      
      for (const categoryTemplate of categoryTemplates) {
        try {
          const existingCategory = await Category.findOne({ 
            name: categoryTemplate.name, 
            user: user._id 
          });
          
          if (existingCategory) {
            console.log(`⚠️  Category "${categoryTemplate.name}" already exists for ${user.email}, skipping...`);
            createdCategories[user._id].push(existingCategory);
          } else {
            const category = new Category({
              ...categoryTemplate,
              user: user._id
            });
            await category.save();
            console.log(`✅ Created category: ${categoryTemplate.name} (${categoryTemplate.type}) for ${user.email}`);
            createdCategories[user._id].push(category);
          }
        } catch (error) {
          console.log(`❌ Failed to create category ${categoryTemplate.name} for ${user.email}: ${error.message}`);
        }
      }
    }

    // Create sample transactions
    console.log('\n💳 Creating sample transactions...');
    
    const transactionTemplates = [
      // Income transactions
      { title: 'Monthly Salary', amount: 5000, type: 'income', paymentMethod: 'bank_transfer', account: 'Checking Account', description: 'Monthly salary payment' },
      { title: 'Freelance Project', amount: 1200, type: 'income', paymentMethod: 'bank_transfer', account: 'Checking Account', description: 'Web development project' },
      { title: 'Stock Dividends', amount: 150, type: 'income', paymentMethod: 'bank_transfer', account: 'Investment Account', description: 'Quarterly dividend payment' },
      
      // Expense transactions
      { title: 'Grocery Shopping', amount: 85.50, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'Weekly grocery shopping' },
      { title: 'Gas Station', amount: 45.00, type: 'expense', paymentMethod: 'debit_card', account: 'Checking Account', description: 'Fuel for car' },
      { title: 'Restaurant Dinner', amount: 67.25, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'Dinner with friends' },
      { title: 'Netflix Subscription', amount: 15.99, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'Monthly streaming subscription' },
      { title: 'Electricity Bill', amount: 120.00, type: 'expense', paymentMethod: 'bank_transfer', account: 'Checking Account', description: 'Monthly electricity bill' },
      { title: 'Coffee Shop', amount: 4.50, type: 'expense', paymentMethod: 'cash', account: 'Cash', description: 'Morning coffee' },
      { title: 'Online Course', amount: 99.00, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'JavaScript course on Udemy' },
      { title: 'Movie Tickets', amount: 24.00, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'Weekend movie night' },
      { title: 'Uber Ride', amount: 12.50, type: 'expense', paymentMethod: 'credit_card', account: 'Credit Card', description: 'Ride to airport' }
    ];

    for (const user of createdUsers) {
      const userCategories = createdCategories[user._id];
      
      for (const transactionTemplate of transactionTemplates) {
        try {
          // Find appropriate category
          const category = userCategories.find(cat => cat.type === transactionTemplate.type);
          
          if (!category) {
            console.log(`⚠️  No ${transactionTemplate.type} category found for ${user.email}, skipping transaction...`);
            continue;
          }

          // Create transaction with random date in the last 30 days
          const randomDaysAgo = Math.floor(Math.random() * 30);
          const transactionDate = new Date();
          transactionDate.setDate(transactionDate.getDate() - randomDaysAgo);

          const transaction = new Transaction({
            ...transactionTemplate,
            user: user._id,
            category: category._id,
            date: transactionDate
          });
          
          await transaction.save();
          console.log(`✅ Created transaction: ${transactionTemplate.title} ($${transactionTemplate.amount}) for ${user.email}`);
        } catch (error) {
          console.log(`❌ Failed to create transaction ${transactionTemplate.title} for ${user.email}: ${error.message}`);
        }
      }
    }

    // Display summary
    console.log('\n=== SEEDING SUMMARY ===');
    
    for (const user of createdUsers) {
      const userCategories = await Category.countDocuments({ user: user._id });
      const userTransactions = await Transaction.countDocuments({ user: user._id });
      const totalIncome = await Transaction.aggregate([
        { $match: { user: user._id, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalExpenses = await Transaction.aggregate([
        { $match: { user: user._id, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      console.log(`\n👤 ${user.firstName} ${user.lastName} (${user.email}):`);
      console.log(`   - Categories: ${userCategories}`);
      console.log(`   - Transactions: ${userTransactions}`);
      console.log(`   - Total Income: $${totalIncome[0]?.total || 0}`);
      console.log(`   - Total Expenses: $${totalExpenses[0]?.total || 0}`);
      console.log(`   - Net Balance: $${(totalIncome[0]?.total || 0) - (totalExpenses[0]?.total || 0)}`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials for Testing:');
    console.log('Email: john.doe@example.com | Password: Password123!');
    console.log('Email: jane.smith@example.com | Password: Password123!');
    
    console.log('\n💡 Usage:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Use the credentials above to login');
    console.log('3. Explore the seeded data in the application');

  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    
    if (error.code === 11000) {
      console.error('💡 Duplicate key error - some data may already exist');
    } else if (error.name === 'ValidationError') {
      console.error('💡 Validation error - check data format');
    } else {
      console.error('💡 Unexpected error - check database connection and models');
    }
    
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Ensure MongoDB is running');
    console.error('2. Check database connection string in .env');
    console.error('3. Verify model schemas are correct');
    console.error('4. Check for existing data conflicts');
  } finally {
    await mongoose.connection.close();
    console.log('\n📋 Database connection closed');
  }
};

// Run the seeding
seedDatabase();