const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const checkSeededUser = async () => {
  try {
    console.log('🔍 Checking seeded user...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    const email = 'john.doe@example.com';
    
    // Find the user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Account Active: ${user.isActive}`);
    console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Last Login: ${user.lastLogin || 'Never'}`);

    // Test password comparison
    const testPassword = 'Password123!';
    const isPasswordValid = await user.comparePassword(testPassword);
    console.log(`   Password Test: ${isPasswordValid ? '✅ Valid' : '❌ Invalid'}`);

    if (!user.isEmailVerified) {
      console.log('\n⚠️  Email not verified - this will block login');
    } else {
      console.log('\n✅ Email is verified - login should work');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

checkSeededUser();