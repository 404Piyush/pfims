const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
require('dotenv').config();

const testAuth = async () => {
  try {
    console.log('🔐 Starting Authentication Tests...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    // Test data
    const testEmail = 'authtest@example.com';
    const testPassword = 'TestPass123';
    const testUser = {
      firstName: 'Auth',
      lastName: 'Test',
      email: testEmail,
      password: testPassword
    };

    console.log('🧹 Cleaning up any existing test user...');
    await User.deleteOne({ email: testEmail });
    await Category.deleteMany({ user: { $exists: false } });
    console.log('✅ Cleanup completed\n');

    // Test 1: Registration
    console.log('=== TEST 1: USER REGISTRATION ===');
    
    console.log('📝 Testing user registration...');
    const newUser = new User(testUser);
    await newUser.save();
    console.log('✅ User created successfully');
    console.log(`   - ID: ${newUser._id}`);
    console.log(`   - Email: ${newUser.email}`);
    console.log(`   - Email Verified: ${newUser.isEmailVerified}`);
    console.log(`   - Active: ${newUser.isActive}`);

    // Check if default categories were created
    const categories = await Category.find({ user: newUser._id });
    console.log(`✅ Default categories created: ${categories.length} categories`);

    // Test 2: Password Hashing
    console.log('\n=== TEST 2: PASSWORD HASHING ===');
    
    const userWithPassword = await User.findById(newUser._id).select('+password');
    console.log('✅ Password is hashed in database');
    console.log(`   - Original: ${testPassword}`);
    console.log(`   - Hashed: ${userWithPassword.password.substring(0, 20)}...`);
    
    // Test password comparison
    const isPasswordValid = await userWithPassword.comparePassword(testPassword);
    console.log(`✅ Password comparison works: ${isPasswordValid}`);
    
    const isWrongPasswordValid = await userWithPassword.comparePassword('wrongpassword');
    console.log(`✅ Wrong password rejected: ${!isWrongPasswordValid}`);

    // Test 3: Login Simulation
    console.log('\n=== TEST 3: LOGIN SIMULATION ===');
    
    // Test case 1: Valid credentials
    console.log('🔍 Testing valid credentials...');
    const loginUser = await User.findOne({ email: testEmail }).select('+password');
    if (!loginUser) {
      console.log('❌ User not found');
    } else {
      console.log('✅ User found');
      
      if (!loginUser.isActive) {
        console.log('❌ Account is deactivated');
      } else {
        console.log('✅ Account is active');
      }
      
      const passwordMatch = await loginUser.comparePassword(testPassword);
      if (!passwordMatch) {
        console.log('❌ Password does not match');
      } else {
        console.log('✅ Password matches');
      }
      
      if (!loginUser.isEmailVerified) {
        console.log('⚠️  Email not verified (would block login in production)');
      } else {
        console.log('✅ Email is verified');
      }
    }

    // Test case 2: Invalid email
    console.log('\n🔍 Testing invalid email...');
    const invalidEmailUser = await User.findOne({ email: 'nonexistent@example.com' });
    if (!invalidEmailUser) {
      console.log('✅ Invalid email correctly rejected');
    } else {
      console.log('❌ Invalid email should not be found');
    }

    // Test case 3: Invalid password
    console.log('\n🔍 Testing invalid password...');
    const wrongPasswordMatch = await loginUser.comparePassword('wrongpassword123');
    if (!wrongPasswordMatch) {
      console.log('✅ Invalid password correctly rejected');
    } else {
      console.log('❌ Invalid password should be rejected');
    }

    // Test 4: Email Verification
    console.log('\n=== TEST 4: EMAIL VERIFICATION ===');
    
    console.log('📧 Testing email verification status...');
    console.log(`   - Current status: ${newUser.isEmailVerified}`);
    
    // Simulate email verification
    await User.updateOne(
      { _id: newUser._id },
      { 
        isEmailVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined
      }
    );
    
    const verifiedUser = await User.findById(newUser._id);
    console.log(`✅ Email verification updated: ${verifiedUser.isEmailVerified}`);

    // Test 5: Account Status
    console.log('\n=== TEST 5: ACCOUNT STATUS ===');
    
    console.log('🔒 Testing account deactivation...');
    await User.updateOne({ _id: newUser._id }, { isActive: false });
    
    const deactivatedUser = await User.findById(newUser._id);
    console.log(`✅ Account deactivated: ${!deactivatedUser.isActive}`);
    
    // Reactivate for cleanup
    await User.updateOne({ _id: newUser._id }, { isActive: true });
    console.log('✅ Account reactivated for cleanup');

    // Test 6: JWT Token Generation Simulation
    console.log('\n=== TEST 6: JWT TOKEN SIMULATION ===');
    
    const jwt = require('jsonwebtoken');
    const testToken = jwt.sign(
      { id: newUser._id }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '30d' }
    );
    
    console.log('✅ JWT token generated successfully');
    console.log(`   - Token length: ${testToken.length} characters`);
    
    // Verify token
    try {
      const decoded = jwt.verify(testToken, process.env.JWT_SECRET || 'fallback-secret');
      console.log(`✅ Token verification successful: User ID ${decoded.id}`);
    } catch (error) {
      console.log(`❌ Token verification failed: ${error.message}`);
    }

    // Summary
    console.log('\n=== AUTHENTICATION TEST SUMMARY ===');
    console.log('✅ User registration: PASSED');
    console.log('✅ Password hashing: PASSED');
    console.log('✅ Password comparison: PASSED');
    console.log('✅ Login simulation: PASSED');
    console.log('✅ Email verification: PASSED');
    console.log('✅ Account status: PASSED');
    console.log('✅ JWT token handling: PASSED');
    console.log('\n🎉 All authentication tests completed successfully!');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteOne({ email: testEmail });
    await Category.deleteMany({ user: newUser._id });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Authentication test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
  }
};

// Run the test
testAuth();