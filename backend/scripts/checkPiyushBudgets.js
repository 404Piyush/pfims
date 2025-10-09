const mongoose = require('mongoose');
const User = require('../models/User');
const Budget = require('../models/Budget');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/pfims', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkPiyushBudgets() {
  try {
    console.log('Connecting to MongoDB...');
    
    // Find the user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('User piyush@gmail.com not found');
      return;
    }
    
    console.log(`Found user: ${user.email} (ID: ${user._id})`);
    
    // Find budgets for this user
    const budgets = await Budget.find({ userId: user._id });
    
    console.log(`\nFound ${budgets.length} budgets for piyush@gmail.com:`);
    
    if (budgets.length > 0) {
      budgets.forEach((budget, index) => {
        console.log(`\n${index + 1}. Budget:`);
        console.log(`   Category: ${budget.categoryId}`);
        console.log(`   Amount: $${budget.amount}`);
        console.log(`   Period: ${budget.period}`);
        console.log(`   Spent: $${budget.spent || 0}`);
        console.log(`   Created: ${budget.createdAt}`);
      });
    } else {
      console.log('No budgets found for this user.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkPiyushBudgets();