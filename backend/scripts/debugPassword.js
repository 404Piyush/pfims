const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const debugPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    const testPassword = 'password123';
    console.log('Test password:', testPassword);

    // Test 1: Direct bcrypt operations
    console.log('\n=== Test 1: Direct bcrypt operations ===');
    const salt = await bcrypt.genSalt(12);
    const directHash = await bcrypt.hash(testPassword, salt);
    console.log('Direct hash:', directHash);
    
    const directCompare = await bcrypt.compare(testPassword, directHash);
    console.log('Direct compare result:', directCompare);

    // Test 2: Create a new user to test the pre-save hook
    console.log('\n=== Test 2: Create new user (test pre-save hook) ===');
    
    // Delete existing test user if exists
    await User.deleteOne({ email: 'test@example.com' });
    
    const newUser = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: testPassword
    });
    
    console.log('Password before save:', newUser.password);
    await newUser.save();
    console.log('User saved successfully');
    
    // Fetch the user with password
    const savedUser = await User.findOne({ email: 'test@example.com' }).select('+password');
    console.log('Password after save (hash):', savedUser.password);
    
    // Test comparePassword method
    const compareResult = await savedUser.comparePassword(testPassword);
    console.log('comparePassword result:', compareResult);

    // Test 3: Check existing dummy user
    console.log('\n=== Test 3: Check existing dummy user ===');
    const dummyUser = await User.findOne({ email: 'jane.smith@test.com' }).select('+password');
    if (dummyUser) {
      console.log('Dummy user password hash:', dummyUser.password);
      const dummyCompare = await dummyUser.comparePassword(testPassword);
      console.log('Dummy user comparePassword result:', dummyCompare);
      
      // Try direct bcrypt compare with dummy user
      const dummyDirectCompare = await bcrypt.compare(testPassword, dummyUser.password);
      console.log('Dummy user direct bcrypt compare:', dummyDirectCompare);
    }

    // Clean up test user
    await User.deleteOne({ email: 'test@example.com' });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

debugPassword();