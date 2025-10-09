const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Category = require('../models/Category');
require('dotenv').config();

const testRegistration = async () => {
  try {
    console.log('📝 Starting Registration Endpoint Tests...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    const baseURL = process.env.BASE_URL || 'http://localhost:5000';
    const testEmail = 'regtest@example.com';

    // Cleanup any existing test user
    console.log('🧹 Cleaning up existing test data...');
    await User.deleteOne({ email: testEmail });
    console.log('✅ Cleanup completed\n');

    // Test 1: Valid Registration
    console.log('=== TEST 1: VALID REGISTRATION ===');
    
    const validUserData = {
      firstName: 'John',
      lastName: 'Doe',
      email: testEmail,
      password: 'ValidPass123',
      currency: 'USD',
      timezone: 'UTC'
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/register`, validUserData);
      console.log('✅ Registration successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Message: ${response.data.message}`);
      console.log(`   - User ID: ${response.data.user?.id}`);
      
      // Verify user was created in database
      const createdUser = await User.findOne({ email: testEmail });
      if (createdUser) {
        console.log('✅ User found in database');
        console.log(`   - Email verified: ${createdUser.isEmailVerified}`);
        console.log(`   - Active: ${createdUser.isActive}`);
        
        // Check default categories
        const categories = await Category.find({ user: createdUser._id });
        console.log(`✅ Default categories created: ${categories.length}`);
      }
    } catch (error) {
      console.log('❌ Registration failed');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 2: Duplicate Email
    console.log('\n=== TEST 2: DUPLICATE EMAIL ===');
    
    try {
      const response = await axios.post(`${baseURL}/api/auth/register`, validUserData);
      console.log('❌ Should have failed with duplicate email');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Duplicate email correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error for duplicate email');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 3: Invalid Email Format
    console.log('\n=== TEST 3: INVALID EMAIL FORMAT ===');
    
    const invalidEmailData = {
      ...validUserData,
      email: 'invalid-email-format'
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/register`, invalidEmailData);
      console.log('❌ Should have failed with invalid email');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Invalid email format correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Validation errors: ${error.response.data.errors?.length || 0}`);
      } else {
        console.log('❌ Unexpected error for invalid email');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 4: Weak Password
    console.log('\n=== TEST 4: WEAK PASSWORD ===');
    
    const weakPasswordData = {
      ...validUserData,
      email: 'weakpass@example.com',
      password: '123'
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/register`, weakPasswordData);
      console.log('❌ Should have failed with weak password');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Weak password correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Validation errors: ${error.response.data.errors?.length || 0}`);
      } else {
        console.log('❌ Unexpected error for weak password');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 5: Missing Required Fields
    console.log('\n=== TEST 5: MISSING REQUIRED FIELDS ===');
    
    const incompleteData = {
      firstName: 'John',
      email: 'incomplete@example.com'
      // Missing lastName and password
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/register`, incompleteData);
      console.log('❌ Should have failed with missing fields');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Missing fields correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Validation errors: ${error.response.data.errors?.length || 0}`);
      } else {
        console.log('❌ Unexpected error for missing fields');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 6: Password Requirements
    console.log('\n=== TEST 6: PASSWORD REQUIREMENTS ===');
    
    const passwordTests = [
      { password: 'lowercase123', desc: 'No uppercase' },
      { password: 'UPPERCASE123', desc: 'No lowercase' },
      { password: 'NoNumbers', desc: 'No numbers' },
      { password: 'Short1', desc: 'Too short' }
    ];

    for (const test of passwordTests) {
      const testData = {
        ...validUserData,
        email: `passtest${Math.random()}@example.com`,
        password: test.password
      };

      try {
        const response = await axios.post(`${baseURL}/api/auth/register`, testData);
        console.log(`❌ Should have failed: ${test.desc}`);
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`✅ ${test.desc} correctly rejected`);
        } else {
          console.log(`❌ Unexpected error for ${test.desc}`);
        }
      }
    }

    console.log('\n=== REGISTRATION TEST SUMMARY ===');
    console.log('✅ Valid registration: TESTED');
    console.log('✅ Duplicate email prevention: TESTED');
    console.log('✅ Email format validation: TESTED');
    console.log('✅ Password strength validation: TESTED');
    console.log('✅ Required field validation: TESTED');
    console.log('✅ Password requirements: TESTED');
    console.log('\n🎉 Registration endpoint tests completed!');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteOne({ email: testEmail });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Registration test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the server is running on the expected port');
    }
  } finally {
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
  }
};

// Run the test
testRegistration();