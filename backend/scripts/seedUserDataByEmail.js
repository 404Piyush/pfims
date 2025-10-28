const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

function getArg(name, defaultVal) {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.split('=')[1];
    }
  }
  return defaultVal;
}

async function seedForEmail() {
  const email = getArg('email', process.env.SEED_EMAIL);
  const firstName = getArg('firstName', 'Piyush');
  const lastName = getArg('lastName', 'Utkar');
  const password = getArg('password', 'password123');
  const currency = getArg('currency', 'INR');

  if (!email) {
    console.error('❌ Missing --email argument.');
    console.log('\nUsage: node backend/scripts/seedUserDataByEmail.js --email="user@example.com" [--firstName=First] [--lastName=Last] [--password=pass] [--currency=INR]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    // 1) Ensure user exists
    let user = await User.findOne({ email });
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
      user = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        isEmailVerified: true,
        currency,
        timezone: 'Asia/Kolkata',
        notifications: {
          email: true,
          transactionAlerts: false,
          budgetAlerts: true,
          weeklyReports: true,
          monthlyReports: true,
        },
        isActive: true,
      });
      await user.save();
      console.log(`👤 Created user: ${email}`);
    } else {
      console.log(`👤 User exists: ${email}`);
    }

    // 2) Ensure default categories
    let categories = await Category.find({ user: user._id });
    if (categories.length === 0) {
      categories = await Category.createDefaultCategories(user._id);
      console.log(`📂 Created ${categories.length} default categories`);
    } else {
      console.log(`📂 Found ${categories.length} categories`);
    }

    const findCatId = (name) => (categories.find(c => c.name === name)?.
      _id) || categories[0]._id;

    // 3) Clear existing transactions and budgets
    await Transaction.deleteMany({ user: user._id });
    await Budget.deleteMany({ user: user._id });
    console.log('🧹 Cleared existing transactions and budgets for this user');

    // 4) Insert transactions for the last 3 months (INR dataset)
    const now = new Date();
    const additionalTransactions = [];

    for (let month = 0; month < 3; month++) {
      const currentDate = new Date(now.getFullYear(), now.getMonth() - month, 1);

      // Monthly salary
      additionalTransactions.push({
        user: user._id,
        title: 'Monthly Salary',
        category: findCatId('Salary'),
        type: 'income',
        amount: 75000,
        description: 'Monthly salary',
        account: 'Primary Bank Account',
        paymentMethod: 'bank_transfer',
        currency,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        status: 'completed',
        tags: ['salary', 'monthly'],
      });

      // Freelance income (two of the last three months)
      if (month < 2) {
        additionalTransactions.push({
          user: user._id,
          title: 'Freelance Project Payment',
          category: findCatId('Freelance'),
          type: 'income',
          amount: 25000,
          description: 'Freelance project payment',
          account: 'Primary Bank Account',
          paymentMethod: 'bank_transfer',
          currency,
          date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 15),
          status: 'completed',
          tags: ['freelance', 'project'],
        });
      }

      const monthlyExpenses = [
        {
          category: 'Food & Dining',
          transactions: [
            { amount: 2500, description: 'Grocery shopping', day: 2, title: 'Grocery Shopping' },
            { amount: 1800, description: 'Restaurant dinner', day: 8, title: 'Restaurant Dinner' },
            { amount: 3200, description: 'Monthly groceries', day: 15, title: 'Monthly Groceries' },
            { amount: 1500, description: 'Food delivery', day: 22, title: 'Food Delivery' },
            { amount: 2000, description: 'Weekend dining', day: 28, title: 'Weekend Dining' },
          ],
        },
        {
          category: 'Transportation',
          transactions: [
            { amount: 3000, description: 'Petrol', day: 5, title: 'Petrol Fill-up' },
            { amount: 500, description: 'Auto rickshaw', day: 12, title: 'Auto Rickshaw' },
            { amount: 2500, description: 'Uber rides', day: 18, title: 'Uber Rides' },
            { amount: 1000, description: 'Metro card recharge', day: 25, title: 'Metro Card Recharge' },
          ],
        },
        {
          category: 'Bills & Utilities',
          transactions: [
            { amount: 2500, description: 'Electricity bill', day: 10, title: 'Electricity Bill' },
            { amount: 1200, description: 'Internet bill', day: 15, title: 'Internet Bill' },
            { amount: 800, description: 'Mobile bill', day: 20, title: 'Mobile Bill' },
            { amount: 1500, description: 'Water bill', day: 25, title: 'Water Bill' },
          ],
        },
        {
          category: 'Entertainment',
          transactions: [
            { amount: 500, description: 'Netflix subscription', day: 1, title: 'Netflix Subscription' },
            { amount: 300, description: 'Spotify premium', day: 1, title: 'Spotify Premium' },
            { amount: 1200, description: 'Movie tickets', day: 14, title: 'Movie Tickets' },
            { amount: 800, description: 'Gaming subscription', day: 20, title: 'Gaming Subscription' },
          ],
        },
        {
          category: 'Shopping',
          transactions: [
            { amount: 4500, description: 'Clothing purchase', day: 7, title: 'Clothing Purchase' },
            { amount: 2200, description: 'Electronics', day: 16, title: 'Electronics Purchase' },
            { amount: 1800, description: 'Books and stationery', day: 23, title: 'Books and Stationery' },
          ],
        },
        {
          category: 'Healthcare',
          transactions: [
            { amount: 1500, description: 'Doctor consultation', day: 11, title: 'Doctor Consultation' },
            { amount: 800, description: 'Medicines', day: 12, title: 'Medicines' },
            { amount: 2000, description: 'Health checkup', day: 20, title: 'Health Checkup' },
          ],
        },
      ];

      // Add expense transactions
      monthlyExpenses.forEach((categoryExpenses) => {
        const catId = findCatId(categoryExpenses.category);
        categoryExpenses.transactions.forEach((transaction) => {
          additionalTransactions.push({
            user: user._id,
            title: transaction.title,
            category: catId,
            type: 'expense',
            amount: transaction.amount,
            description: transaction.description,
            account: 'Primary Bank Account',
            paymentMethod:
              categoryExpenses.category === 'Bills & Utilities'
                ? 'bank_transfer'
                : Math.random() > 0.5
                ? 'credit_card'
                : 'debit_card',
            currency,
            date: new Date(currentDate.getFullYear(), currentDate.getMonth(), transaction.day),
            status: 'completed',
            tags: [categoryExpenses.category.toLowerCase().replace(/\s+/g, '-')],
          });
        });
      });
    }

    await Transaction.insertMany(additionalTransactions);
    console.log(`🧾 Created ${additionalTransactions.length} transactions for ${email}`);

    // 5) Create budgets for current month
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const budgets = [
      {
        user: user._id,
        name: 'Monthly Living Expenses',
        description: 'Budget for essential monthly expenses',
        categories: [
          {
            category: findCatId('Food & Dining'),
            budgetAmount: 15000,
            spentAmount: 0,
            alertThreshold: 80,
          },
          {
            category: findCatId('Transportation'),
            budgetAmount: 8000,
            spentAmount: 0,
            alertThreshold: 85,
          },
          {
            category: findCatId('Bills & Utilities'),
            budgetAmount: 7000,
            spentAmount: 0,
            alertThreshold: 90,
          },
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 30000,
        totalSpent: 0,
        currency,
        isActive: true,
        notifications: {
          email: true,
          push: true,
          thresholdAlerts: true,
          overBudgetAlerts: true,
        },
      },
      {
        user: user._id,
        name: 'Entertainment & Lifestyle',
        description: 'Budget for entertainment and discretionary spending',
        categories: [
          {
            category: findCatId('Entertainment'),
            budgetAmount: 5000,
            spentAmount: 0,
            alertThreshold: 75,
          },
          {
            category: findCatId('Shopping'),
            budgetAmount: 10000,
            spentAmount: 0,
            alertThreshold: 80,
          },
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 15000,
        totalSpent: 0,
        currency,
        isActive: true,
        notifications: {
          email: true,
          push: false,
          thresholdAlerts: true,
          overBudgetAlerts: true,
        },
      },
      {
        user: user._id,
        name: 'Healthcare Budget',
        description: 'Monthly healthcare and medical expenses',
        categories: [
          {
            category: findCatId('Healthcare'),
            budgetAmount: 5000,
            spentAmount: 0,
            alertThreshold: 70,
          },
        ],
        period: 'monthly',
        startDate: currentMonth,
        endDate: currentMonthEnd,
        totalBudget: 5000,
        totalSpent: 0,
        currency,
        isActive: true,
        notifications: {
          email: true,
          push: true,
          thresholdAlerts: true,
          overBudgetAlerts: true,
        },
      },
    ];

    const insertedBudgets = await Budget.insertMany(budgets);
    console.log(`📊 Created ${insertedBudgets.length} budgets for ${email}`);

    // 6) Update spent amounts using inserted transactions
    for (const b of insertedBudgets) {
      const fresh = await Budget.findById(b._id);
      await fresh.updateSpentAmounts();
      console.log(`   • Updated budget "${fresh.name}": totalSpent = ${fresh.totalSpent}/${fresh.totalBudget}`);
    }

    console.log('\n✅ Seeding complete for', email);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seedForEmail();