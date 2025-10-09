require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const BudgetAlertService = require('../utils/budgetAlertService');

async function testBudgetAlerts() {
  try {
    console.log('🧪 Testing Budget Alert System...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Connected to MongoDB');

    // Find a test user (using Piyush's data)
    const testUser = await User.findOne({ email: 'piyush@gmail.com' });
    if (!testUser) {
      console.log('❌ Test user not found. Please run seedPiyushData.js first');
      return;
    }

    console.log('👤 Found test user:', testUser.name);

    // Find an active budget for the user
    const activeBudget = await Budget.findOne({
      user: testUser._id,
      isActive: true
    }).populate('categories.category');

    if (!activeBudget) {
      console.log('❌ No active budget found for test user');
      return;
    }

    console.log('💰 Found active budget:', activeBudget.name);

    // Find a category with some budget allocation
    const testCategory = activeBudget.categories.find(cat => cat.budgetAmount > 0);
    if (!testCategory) {
      console.log('❌ No category with budget allocation found');
      return;
    }

    console.log('📂 Testing with category:', testCategory.category.name);
    console.log('💵 Budget amount:', testCategory.budgetAmount);
    console.log('💸 Current spent:', testCategory.spentAmount);
    console.log('⚠️ Alert threshold:', testCategory.alertThreshold + '%');

    // Calculate amount needed to trigger threshold alert
    const thresholdAmount = (testCategory.budgetAmount * testCategory.alertThreshold / 100) - testCategory.spentAmount + 1;
    
    if (thresholdAmount <= 0) {
      console.log('⚠️ Category already over threshold, testing over-budget alert');
      
      // Create a transaction that will push over budget
      const overBudgetAmount = testCategory.budgetAmount - testCategory.spentAmount + 50;
      
      const testTransaction = new Transaction({
        user: testUser._id,
        title: 'Test Over-Budget Transaction',
        amount: overBudgetAmount,
        type: 'expense',
        category: testCategory.category._id,
        account: 'Test Account',
        description: 'Testing budget alert system - over budget'
      });

      console.log('💳 Creating test transaction for $' + overBudgetAmount);
      
      // Update budget spent amounts
      await activeBudget.updateSpentAmounts();
      
      // Test budget alert
      await BudgetAlertService.checkAndSendAlerts(activeBudget, testTransaction);
      
    } else {
      console.log('📧 Creating test transaction to trigger threshold alert');
      console.log('💰 Transaction amount: $' + thresholdAmount.toFixed(2));
      
      const testTransaction = new Transaction({
        user: testUser._id,
        title: 'Test Threshold Transaction',
        amount: thresholdAmount,
        type: 'expense',
        category: testCategory.category._id,
        account: 'Test Account',
        description: 'Testing budget alert system - threshold'
      });

      // Update budget spent amounts
      await activeBudget.updateSpentAmounts();
      
      // Test budget alert
      await BudgetAlertService.checkAndSendAlerts(activeBudget, testTransaction);
    }

    console.log('✅ Budget alert test completed!');
    console.log('📬 Check your Mailtrap inbox for budget alert emails');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the test
testBudgetAlerts();