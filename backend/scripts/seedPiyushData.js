const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
require('dotenv').config();

const seedPiyushData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Find the existing user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('User piyush@gmail.com not found');
      return;
    }

    console.log('Found user:', user.email);

    // Get existing categories
    const categories = await Category.find({ user: user._id });
    console.log(`Found ${categories.length} categories`);

    // Create additional transactions for better analytics (last 3 months)
    const now = new Date();
    const additionalTransactions = [];

    // Generate transactions for the last 3 months
    for (let month = 0; month < 3; month++) {
      const currentDate = new Date(now.getFullYear(), now.getMonth() - month, 1);
      
      // Monthly salary
      additionalTransactions.push({
        user: user._id,
        title: 'Monthly Salary',
        category: categories.find(c => c.name === 'Salary')?._id || categories[0]._id,
        type: 'income',
        amount: 75000,
        description: 'Monthly salary',
        account: 'Primary Bank Account',
        paymentMethod: 'bank_transfer',
        currency: 'INR',
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        status: 'completed',
        tags: ['salary', 'monthly']
      });

      // Freelance income
      if (month < 2) {
        additionalTransactions.push({
          user: user._id,
          title: 'Freelance Project Payment',
          category: categories.find(c => c.name === 'Freelance')?._id || categories[0]._id,
          type: 'income',
          amount: 25000,
          description: 'Freelance project payment',
          account: 'Primary Bank Account',
          paymentMethod: 'bank_transfer',
          currency: 'INR',
          date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15),
          status: 'completed',
          tags: ['freelance', 'project']
        });
      }

      // Monthly expenses
      const monthlyExpenses = [
        {
          category: 'Food & Dining',
          transactions: [
            { amount: 2500, description: 'Grocery shopping', day: 2, title: 'Grocery Shopping' },
            { amount: 1800, description: 'Restaurant dinner', day: 8, title: 'Restaurant Dinner' },
            { amount: 3200, description: 'Monthly groceries', day: 15, title: 'Monthly Groceries' },
            { amount: 1500, description: 'Food delivery', day: 22, title: 'Food Delivery' },
            { amount: 2000, description: 'Weekend dining', day: 28, title: 'Weekend Dining' }
          ]
        },
        {
          category: 'Transportation',
          transactions: [
            { amount: 3000, description: 'Petrol', day: 5, title: 'Petrol Fill-up' },
            { amount: 500, description: 'Auto rickshaw', day: 12, title: 'Auto Rickshaw' },
            { amount: 2500, description: 'Uber rides', day: 18, title: 'Uber Rides' },
            { amount: 1000, description: 'Metro card recharge', day: 25, title: 'Metro Card Recharge' }
          ]
        },
        {
          category: 'Bills & Utilities',
          transactions: [
            { amount: 2500, description: 'Electricity bill', day: 10, title: 'Electricity Bill' },
            { amount: 1200, description: 'Internet bill', day: 15, title: 'Internet Bill' },
            { amount: 800, description: 'Mobile bill', day: 20, title: 'Mobile Bill' },
            { amount: 1500, description: 'Water bill', day: 25, title: 'Water Bill' }
          ]
        },
        {
          category: 'Entertainment',
          transactions: [
            { amount: 500, description: 'Netflix subscription', day: 1, title: 'Netflix Subscription' },
            { amount: 300, description: 'Spotify premium', day: 1, title: 'Spotify Premium' },
            { amount: 1200, description: 'Movie tickets', day: 14, title: 'Movie Tickets' },
            { amount: 800, description: 'Gaming subscription', day: 20, title: 'Gaming Subscription' }
          ]
        },
        {
          category: 'Shopping',
          transactions: [
            { amount: 4500, description: 'Clothing purchase', day: 7, title: 'Clothing Purchase' },
            { amount: 2200, description: 'Electronics', day: 16, title: 'Electronics Purchase' },
            { amount: 1800, description: 'Books and stationery', day: 23, title: 'Books and Stationery' }
          ]
        },
        {
          category: 'Healthcare',
          transactions: [
            { amount: 1500, description: 'Doctor consultation', day: 11, title: 'Doctor Consultation' },
            { amount: 800, description: 'Medicines', day: 12, title: 'Medicines' },
            { amount: 2000, description: 'Health checkup', day: 20, title: 'Health Checkup' }
          ]
        }
      ];

      // Add expense transactions
      monthlyExpenses.forEach(categoryExpenses => {
        const category = categories.find(c => c.name === categoryExpenses.category);
        if (category) {
          categoryExpenses.transactions.forEach(transaction => {
            additionalTransactions.push({
              user: user._id,
              title: transaction.title,
              category: category._id,
              type: 'expense',
              amount: transaction.amount,
              description: transaction.description,
              account: 'Primary Bank Account',
              paymentMethod: categoryExpenses.category === 'Bills & Utilities' ? 'bank_transfer' : (Math.random() > 0.5 ? 'credit_card' : 'debit_card'),
              currency: 'INR',
              date: new Date(currentDate.getFullYear(), currentDate.getMonth(), transaction.day),
              status: 'completed',
              tags: [categoryExpenses.category.toLowerCase().replace(/\s+/g, '-')]
            });
          });
        }
      });
    }

    // Insert additional transactions
    await Transaction.insertMany(additionalTransactions);
    console.log(`Created ${additionalTransactions.length} additional transactions`);

    // Create budgets for the current month and next month
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    // Delete existing budgets for piyush@gmail.com to avoid duplicates
    await Budget.deleteMany({ user: user._id });

    const budgets = [
      {
        user: user._id,
        name: 'Monthly Living Expenses',
        description: 'Budget for essential monthly expenses',
        categories: [
          {
            category: categories.find(c => c.name === 'Food & Dining')?._id,
            budgetAmount: 15000,
            spentAmount: 0,
            alertThreshold: 80
          },
          {
            category: categories.find(c => c.name === 'Transportation')?._id,
            budgetAmount: 8000,
            spentAmount: 0,
            alertThreshold: 85
          },
          {
            category: categories.find(c => c.name === 'Bills & Utilities')?._id,
            budgetAmount: 7000,
            spentAmount: 0,
            alertThreshold: 90
          }
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 30000,
        totalSpent: 0,
        currency: 'INR',
        isActive: true,
        notifications: {
          email: true,
          push: true,
          thresholdAlerts: true,
          overBudgetAlerts: true
        }
      },
      {
        user: user._id,
        name: 'Entertainment & Lifestyle',
        description: 'Budget for entertainment and discretionary spending',
        categories: [
          {
            category: categories.find(c => c.name === 'Entertainment')?._id,
            budgetAmount: 5000,
            spentAmount: 0,
            alertThreshold: 75
          },
          {
            category: categories.find(c => c.name === 'Shopping')?._id,
            budgetAmount: 10000,
            spentAmount: 0,
            alertThreshold: 80
          }
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 15000,
        totalSpent: 0,
        currency: 'INR',
        isActive: true,
        notifications: {
          email: true,
          push: false,
          thresholdAlerts: true,
          overBudgetAlerts: true
        }
      },
      {
        user: user._id,
        name: 'Healthcare Budget',
        description: 'Monthly healthcare and medical expenses',
        categories: [
          {
            category: categories.find(c => c.name === 'Healthcare')?._id,
            budgetAmount: 5000,
            spentAmount: 0,
            alertThreshold: 70
          }
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 5000,
        totalSpent: 0,
        currency: 'INR',
        isActive: true,
        notifications: {
          email: true,
          push: true,
          thresholdAlerts: true,
          overBudgetAlerts: true
        }
      },
      {
        user: user._id,
        name: 'Next Month Budget',
        description: 'Comprehensive budget for next month',
        categories: [
          {
            category: categories.find(c => c.name === 'Food & Dining')?._id,
            budgetAmount: 16000,
            spentAmount: 0,
            alertThreshold: 80
          },
          {
            category: categories.find(c => c.name === 'Transportation')?._id,
            budgetAmount: 9000,
            spentAmount: 0,
            alertThreshold: 85
          },
          {
            category: categories.find(c => c.name === 'Bills & Utilities')?._id,
            budgetAmount: 7500,
            spentAmount: 0,
            alertThreshold: 90
          },
          {
            category: categories.find(c => c.name === 'Entertainment')?._id,
            budgetAmount: 6000,
            spentAmount: 0,
            alertThreshold: 75
          },
          {
            category: categories.find(c => c.name === 'Shopping')?._id,
            budgetAmount: 12000,
            spentAmount: 0,
            alertThreshold: 80
          },
          {
            category: categories.find(c => c.name === 'Healthcare')?._id,
            budgetAmount: 4000,
            spentAmount: 0,
            alertThreshold: 70
          }
        ],
        period: 'monthly',
        startDate: nextMonth,
        endDate: nextMonthEnd,
        totalBudget: 54500,
        totalSpent: 0,
        currency: 'INR',
        isActive: true,
        notifications: {
          email: true,
          push: true,
          thresholdAlerts: true,
          overBudgetAlerts: true
        }
      }
    ];

    // Filter out budgets with undefined categories
    const validBudgets = budgets.filter(budget => 
      budget.categories.every(cat => cat.category)
    );

    await Budget.insertMany(validBudgets);
    console.log(`Created ${validBudgets.length} budgets`);

    // Update budget spent amounts based on current month transactions
    for (const budget of validBudgets) {
      if (budget.startDate.getMonth() === now.getMonth()) {
        let totalSpent = 0;
        
        for (const categoryBudget of budget.categories) {
          const spent = await Transaction.aggregate([
            {
              $match: {
                user: user._id,
                category: categoryBudget.category,
                type: 'expense',
                status: 'completed',
                date: {
                  $gte: budget.startDate,
                  $lte: budget.endDate
                }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' }
              }
            }
          ]);

          const spentAmount = spent.length > 0 ? spent[0].total : 0;
          categoryBudget.spentAmount = spentAmount;
          totalSpent += spentAmount;
        }

        budget.totalSpent = totalSpent;
        await Budget.findByIdAndUpdate(budget._id, {
          categories: budget.categories,
          totalSpent: totalSpent
        });
      }
    }

    console.log('Updated budget spent amounts');

    console.log('\nPiyush data seeding completed successfully!');
    console.log('- Added comprehensive transaction history');
    console.log('- Created multiple budgets with different categories');
    console.log('- Updated spent amounts based on actual transactions');
    console.log('- All pages should now show meaningful data');

  } catch (error) {
    console.error('Error seeding Piyush data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
seedPiyushData();