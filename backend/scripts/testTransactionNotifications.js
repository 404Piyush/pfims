require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const emailService = require('../utils/emailService');

async function testTransactionNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Connected to MongoDB');

    // Check if email service is configured
    if (!emailService.isConfigured) {
      console.error('❌ Email service is not configured');
      return;
    }
    console.log('✅ Email service configured successfully');

    // Find test user
    const testUser = await User.findOne({ email: 'piyush@gmail.com' });
    if (!testUser) {
      console.error('❌ Test user not found. Please run seedPiyushUser.js first');
      return;
    }
    console.log('👤 Found test user:', testUser.firstName);

    // Enable transaction notifications for the user
    testUser.notifications = {
      email: true,
      transactionAlerts: true,
      budgetAlerts: true,
      weeklyReports: false,
      monthlyReports: false
    };
    await testUser.save();
    console.log('🔔 Enabled transaction notifications for user');

    // Find a category
    const category = await Category.findOne({ user: testUser._id, isActive: true });
    if (!category) {
      console.error('❌ No active category found for user');
      return;
    }
    console.log('📂 Testing with category:', category.name);

    // Create test expense transaction
    const expenseTransaction = new Transaction({
      title: 'Test Expense Notification',
      description: 'Testing transaction notification email system',
      amount: 25.99,
      type: 'expense',
      category: category._id,
      user: testUser._id,
      account: 'Test Account',
      paymentMethod: 'credit_card',
      date: new Date()
    });

    await expenseTransaction.save();
    console.log('💸 Created test expense transaction: $' + expenseTransaction.amount);

    // Send notification email
    await emailService.sendTransactionNotificationEmail(testUser, expenseTransaction, category);
    console.log('📧 Expense notification email sent!');

    // Create test income transaction
    const incomeTransaction = new Transaction({
      title: 'Test Income Notification',
      description: 'Testing income notification email system',
      amount: 150.00,
      type: 'income',
      category: category._id,
      user: testUser._id,
      account: 'Test Account',
      paymentMethod: 'bank_transfer',
      date: new Date()
    });

    await incomeTransaction.save();
    console.log('💰 Created test income transaction: $' + incomeTransaction.amount);

    // Send notification email
    await emailService.sendTransactionNotificationEmail(testUser, incomeTransaction, category);
    console.log('📧 Income notification email sent!');

    console.log('✅ Transaction notification test completed!');
    console.log('📬 Check your Mailtrap inbox for transaction notification emails');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

testTransactionNotifications();