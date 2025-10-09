const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const fixSeededUserPassword = async () => {
  try {
    console.log('🔧 Fixing seeded user password...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    const email = 'john.doe@example.com';
    const newPassword = 'Password123!';
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Current User Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Account Active: ${user.isActive}`);

    // Hash the new password properly
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the user's password
    await User.findByIdAndUpdate(user._id, { 
      password: hashedPassword 
    });

    console.log('\n✅ Password updated successfully');
    
    // Verify the password works
    const updatedUser = await User.findById(user._id).select('+password');
    const isPasswordValid = await updatedUser.comparePassword(newPassword);
    console.log(`✅ Password verification: ${isPasswordValid ? 'PASSED' : 'FAILED'}`);

    console.log('\n📋 Login Credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

fixSeededUserPassword();