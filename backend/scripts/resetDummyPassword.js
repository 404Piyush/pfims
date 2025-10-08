const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const resetDummyPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'jane.smith@test.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', user.email);

    // Hash the password properly
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    console.log('New password:', newPassword);
    console.log('New hash (first 20 chars):', hashedPassword.substring(0, 20));

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    console.log('Password updated successfully');

    // Test the new password
    const testUser = await User.findOne({ email: 'jane.smith@test.com' }).select('+password');
    const isMatch = await testUser.comparePassword(newPassword);
    console.log('Password verification test:', isMatch);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

resetDummyPassword();