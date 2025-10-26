const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const testLogin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'jane.smith@test.com' }).select('+password');
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', {
      email: user.email,
      isActive: user.isActive,
      hasPassword: !!user.password
    });

    // Test password comparison
    const testPassword = 'password123';
    console.log('Testing password:', testPassword);
    
    const isMatch = await user.comparePassword(testPassword);
    console.log('Password match result:', isMatch);

    // Also test bcrypt directly
    const directMatch = await bcrypt.compare(testPassword, user.password);
    console.log('Direct bcrypt comparison:', directMatch);

    // Show password hash (first 20 chars for debugging)
    console.log('Password hash (first 20 chars):', user.password.substring(0, 20));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

testLogin();