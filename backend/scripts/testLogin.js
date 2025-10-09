const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const testLogin = async () => {
  try {
    console.log('🔐 Starting Login Endpoint Tests...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB\n');

    const baseURL = process.env.BASE_URL || 'http://localhost:5000';
    const testEmail = 'logintest@example.com';
    const testPassword = 'TestPass123';

    // Setup test user
    console.log('🧹 Setting up test user...');
    await User.deleteOne({ email: testEmail });
    
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    const testUser = new User({
      firstName: 'Login',
      lastName: 'Test',
      email: testEmail,
      password: hashedPassword,
      isEmailVerified: true,
      isActive: true,
      currency: 'USD',
      timezone: 'UTC'
    });
    
    await testUser.save();
    console.log('✅ Test user created\n');

    // Test 1: Valid Login
    console.log('=== TEST 1: VALID LOGIN ===');
    
    const validCredentials = {
      email: testEmail,
      password: testPassword
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, validCredentials);
      console.log('✅ Login successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Message: ${response.data.message}`);
      console.log(`   - Token provided: ${!!response.data.token}`);
      console.log(`   - User data: ${!!response.data.user}`);
      
      if (response.data.token) {
        console.log(`   - Token length: ${response.data.token.length} characters`);
      }
    } catch (error) {
      console.log('❌ Valid login failed');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 2: Invalid Email
    console.log('\n=== TEST 2: INVALID EMAIL ===');
    
    const invalidEmailCredentials = {
      email: 'nonexistent@example.com',
      password: testPassword
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, invalidEmailCredentials);
      console.log('❌ Should have failed with invalid email');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Invalid email correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error for invalid email');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 3: Invalid Password
    console.log('\n=== TEST 3: INVALID PASSWORD ===');
    
    const invalidPasswordCredentials = {
      email: testEmail,
      password: 'WrongPassword123'
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, invalidPasswordCredentials);
      console.log('❌ Should have failed with invalid password');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Invalid password correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error for invalid password');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 4: Unverified Email
    console.log('\n=== TEST 4: UNVERIFIED EMAIL ===');
    
    // Create unverified user
    const unverifiedEmail = 'unverified@example.com';
    await User.deleteOne({ email: unverifiedEmail });
    
    const unverifiedUser = new User({
      firstName: 'Unverified',
      lastName: 'User',
      email: unverifiedEmail,
      password: hashedPassword,
      isEmailVerified: false,
      isActive: true,
      currency: 'USD',
      timezone: 'UTC'
    });
    
    await unverifiedUser.save();

    const unverifiedCredentials = {
      email: unverifiedEmail,
      password: testPassword
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, unverifiedCredentials);
      console.log('❌ Should have failed with unverified email');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Unverified email correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error for unverified email');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 5: Inactive Account
    console.log('\n=== TEST 5: INACTIVE ACCOUNT ===');
    
    // Create inactive user
    const inactiveEmail = 'inactive@example.com';
    await User.deleteOne({ email: inactiveEmail });
    
    const inactiveUser = new User({
      firstName: 'Inactive',
      lastName: 'User',
      email: inactiveEmail,
      password: hashedPassword,
      isEmailVerified: true,
      isActive: false,
      currency: 'USD',
      timezone: 'UTC'
    });
    
    await inactiveUser.save();

    const inactiveCredentials = {
      email: inactiveEmail,
      password: testPassword
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, inactiveCredentials);
      console.log('❌ Should have failed with inactive account');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Inactive account correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Message: ${error.response.data.message}`);
      } else {
        console.log('❌ Unexpected error for inactive account');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 6: Missing Fields
    console.log('\n=== TEST 6: MISSING FIELDS ===');
    
    const missingFieldTests = [
      { data: { password: testPassword }, desc: 'Missing email' },
      { data: { email: testEmail }, desc: 'Missing password' },
      { data: {}, desc: 'Missing both fields' }
    ];

    for (const test of missingFieldTests) {
      try {
        const response = await axios.post(`${baseURL}/api/auth/login`, test.data);
        console.log(`❌ Should have failed: ${test.desc}`);
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`✅ ${test.desc} correctly rejected`);
          console.log(`   - Validation errors: ${error.response.data.errors?.length || 0}`);
        } else {
          console.log(`❌ Unexpected error for ${test.desc}`);
        }
      }
    }

    // Test 7: Invalid Email Format
    console.log('\n=== TEST 7: INVALID EMAIL FORMAT ===');
    
    const invalidFormatCredentials = {
      email: 'invalid-email-format',
      password: testPassword
    };

    try {
      const response = await axios.post(`${baseURL}/api/auth/login`, invalidFormatCredentials);
      console.log('❌ Should have failed with invalid email format');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Invalid email format correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
        console.log(`   - Validation errors: ${error.response.data.errors?.length || 0}`);
      } else {
        console.log('❌ Unexpected error for invalid email format');
        console.log(`   - Status: ${error.response?.status}`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log('\n=== LOGIN TEST SUMMARY ===');
    console.log('✅ Valid login: TESTED');
    console.log('✅ Invalid email rejection: TESTED');
    console.log('✅ Invalid password rejection: TESTED');
    console.log('✅ Unverified email rejection: TESTED');
    console.log('✅ Inactive account rejection: TESTED');
    console.log('✅ Missing field validation: TESTED');
    console.log('✅ Email format validation: TESTED');
    console.log('\n🎉 Login endpoint tests completed!');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteMany({ 
      email: { $in: [testEmail, unverifiedEmail, inactiveEmail] } 
    });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Login test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the server is running on the expected port');
    }
  } finally {
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
  }
};

// Run the test
testLogin();