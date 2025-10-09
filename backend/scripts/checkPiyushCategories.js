const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');

async function checkPiyushCategories() {
  try {
    await mongoose.connect('mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');
    
    // Find piyush user
    const user = await User.findOne({ email: 'piyush@gmail.com' });
    if (!user) {
      console.log('❌ User piyush@gmail.com not found');
      return;
    }
    
    console.log('✅ User found:', user._id);
    
    // Find categories for this user
    const categories = await Category.find({ user: user._id });
    console.log(`\nCategories count: ${categories.length}`);
    
    if (categories.length > 0) {
      console.log('\nCategories:');
      categories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.name} (${cat.type}) - ${cat.color}`);
      });
    } else {
      console.log('❌ No categories found for this user');
      
      // Check if there are any categories at all
      const allCategories = await Category.find({});
      console.log(`\nTotal categories in database: ${allCategories.length}`);
      if (allCategories.length > 0) {
        console.log('Sample categories:');
        allCategories.slice(0, 5).forEach((cat, index) => {
          console.log(`${index + 1}. ${cat.name} (${cat.type}) - User: ${cat.user}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkPiyushCategories();