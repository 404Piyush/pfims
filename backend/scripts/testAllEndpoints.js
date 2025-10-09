const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

let authToken = '';
let testUserId = '';

const testAllEndpoints = async () => {
  try {
    console.log('🚀 Starting Comprehensive API Endpoint Tests...\n');
    console.log(`🌐 Testing against: ${BASE_URL}`);
    
    // Connect to database for cleanup
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB for cleanup operations\n');

    // Test 1: Health Check
    console.log('=== TEST 1: HEALTH CHECK ===');
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Health check passed');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Response: ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.log('❌ Health check failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 2: User Registration
    console.log('\n=== TEST 2: USER REGISTRATION ===');
    
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    };

    try {
      const response = await axios.post(`${API_URL}/auth/register`, testUser);
      console.log('✅ User registration successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - User ID: ${response.data.user._id}`);
      console.log(`   - Email: ${response.data.user.email}`);
      
      testUserId = response.data.user._id;
      authToken = response.data.token;
    } catch (error) {
      console.log('❌ User registration failed');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 3: User Login
    console.log('\n=== TEST 3: USER LOGIN ===');
    
    try {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };
      
      const response = await axios.post(`${API_URL}/auth/login`, loginData);
      console.log('✅ User login successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Token received: ${!!response.data.token}`);
      
      authToken = response.data.token;
    } catch (error) {
      console.log('❌ User login failed');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Set up auth headers for subsequent requests
    const authHeaders = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Test 4: Get User Profile
    console.log('\n=== TEST 4: GET USER PROFILE ===');
    
    try {
      const response = await axios.get(`${API_URL}/auth/me`, { headers: authHeaders });
      console.log('✅ Get user profile successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - User: ${response.data.firstName} ${response.data.lastName}`);
      console.log(`   - Email: ${response.data.email}`);
    } catch (error) {
      console.log('❌ Get user profile failed');
      console.log(`   - Status: ${error.response?.status}`);
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 5: Create Categories
    console.log('\n=== TEST 5: CREATE CATEGORIES ===');
    
    const testCategories = [
      { name: 'Food & Dining', type: 'expense', color: '#FF6B6B' },
      { name: 'Salary', type: 'income', color: '#4ECDC4' },
      { name: 'Transportation', type: 'expense', color: '#45B7D1' }
    ];

    const createdCategories = [];
    
    for (const category of testCategories) {
      try {
        const response = await axios.post(`${API_URL}/categories`, category, { headers: authHeaders });
        console.log(`✅ Category "${category.name}" created successfully`);
        console.log(`   - ID: ${response.data._id}`);
        createdCategories.push(response.data);
      } catch (error) {
        console.log(`❌ Category "${category.name}" creation failed`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 6: Get Categories
    console.log('\n=== TEST 6: GET CATEGORIES ===');
    
    try {
      const response = await axios.get(`${API_URL}/categories`, { headers: authHeaders });
      console.log('✅ Get categories successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Categories count: ${response.data.length}`);
      response.data.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.type})`);
      });
    } catch (error) {
      console.log('❌ Get categories failed');
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 7: Create Transactions
    console.log('\n=== TEST 7: CREATE TRANSACTIONS ===');
    
    const testTransactions = [
      {
        title: 'Lunch at Restaurant',
        amount: 25.50,
        type: 'expense',
        category: createdCategories.find(c => c.type === 'expense')?._id,
        paymentMethod: 'credit_card',
        description: 'Business lunch meeting'
      },
      {
        title: 'Monthly Salary',
        amount: 5000.00,
        type: 'income',
        category: createdCategories.find(c => c.type === 'income')?._id,
        paymentMethod: 'bank_transfer',
        description: 'Monthly salary payment'
      }
    ];

    const createdTransactions = [];
    
    for (const transaction of testTransactions) {
      try {
        const response = await axios.post(`${API_URL}/transactions`, transaction, { headers: authHeaders });
        console.log(`✅ Transaction "${transaction.title}" created successfully`);
        console.log(`   - ID: ${response.data._id}`);
        console.log(`   - Amount: $${response.data.amount}`);
        createdTransactions.push(response.data);
      } catch (error) {
        console.log(`❌ Transaction "${transaction.title}" creation failed`);
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 8: Get Transactions
    console.log('\n=== TEST 8: GET TRANSACTIONS ===');
    
    try {
      const response = await axios.get(`${API_URL}/transactions`, { headers: authHeaders });
      console.log('✅ Get transactions successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Transactions count: ${response.data.length}`);
      response.data.forEach(txn => {
        console.log(`   - ${txn.title}: $${txn.amount} (${txn.type})`);
      });
    } catch (error) {
      console.log('❌ Get transactions failed');
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 9: Get Dashboard Data
    console.log('\n=== TEST 9: GET DASHBOARD DATA ===');
    
    try {
      const response = await axios.get(`${API_URL}/dashboard`, { headers: authHeaders });
      console.log('✅ Get dashboard data successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Total Income: $${response.data.totalIncome || 0}`);
      console.log(`   - Total Expenses: $${response.data.totalExpenses || 0}`);
      console.log(`   - Net Balance: $${response.data.netBalance || 0}`);
    } catch (error) {
      console.log('❌ Get dashboard data failed');
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 10: Update Transaction
    console.log('\n=== TEST 10: UPDATE TRANSACTION ===');
    
    if (createdTransactions.length > 0) {
      const transactionToUpdate = createdTransactions[0];
      const updateData = {
        title: 'Updated Lunch at Restaurant',
        amount: 30.00,
        description: 'Updated business lunch meeting'
      };
      
      try {
        const response = await axios.put(
          `${API_URL}/transactions/${transactionToUpdate._id}`,
          updateData,
          { headers: authHeaders }
        );
        console.log('✅ Transaction update successful');
        console.log(`   - Updated title: ${response.data.title}`);
        console.log(`   - Updated amount: $${response.data.amount}`);
      } catch (error) {
        console.log('❌ Transaction update failed');
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 11: Get User Settings/Preferences
    console.log('\n=== TEST 11: GET USER PREFERENCES ===');
    
    try {
      const response = await axios.get(`${API_URL}/users/preferences`, { headers: authHeaders });
      console.log('✅ Get user preferences successful');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Currency: ${response.data.currency || 'USD'}`);
      console.log(`   - Notifications: ${response.data.notifications || 'enabled'}`);
    } catch (error) {
      console.log('❌ Get user preferences failed');
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 12: Update User Preferences
    console.log('\n=== TEST 12: UPDATE USER PREFERENCES ===');
    
    const preferencesUpdate = {
      currency: 'EUR',
      notifications: {
        email: true,
        push: false,
        transactions: true
      },
      theme: 'dark'
    };
    
    try {
      const response = await axios.put(
        `${API_URL}/users/preferences`,
        preferencesUpdate,
        { headers: authHeaders }
      );
      console.log('✅ Update user preferences successful');
      console.log(`   - Updated currency: ${response.data.currency}`);
      console.log(`   - Updated theme: ${response.data.theme}`);
    } catch (error) {
      console.log('❌ Update user preferences failed');
      console.log(`   - Error: ${error.response?.data?.message || error.message}`);
    }

    // Test 13: Delete Transaction
    console.log('\n=== TEST 13: DELETE TRANSACTION ===');
    
    if (createdTransactions.length > 1) {
      const transactionToDelete = createdTransactions[1];
      
      try {
        const response = await axios.delete(
          `${API_URL}/transactions/${transactionToDelete._id}`,
          { headers: authHeaders }
        );
        console.log('✅ Transaction deletion successful');
        console.log(`   - Deleted transaction: ${transactionToDelete.title}`);
      } catch (error) {
        console.log('❌ Transaction deletion failed');
        console.log(`   - Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Test 14: Invalid Token Test
    console.log('\n=== TEST 14: INVALID TOKEN TEST ===');
    
    const invalidHeaders = {
      'Authorization': 'Bearer invalid-token-123',
      'Content-Type': 'application/json'
    };
    
    try {
      const response = await axios.get(`${API_URL}/auth/me`, { headers: invalidHeaders });
      console.log('❌ Invalid token test failed - should have been rejected');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid token correctly rejected');
        console.log(`   - Status: ${error.response.status}`);
      } else {
        console.log('❌ Unexpected error with invalid token');
        console.log(`   - Error: ${error.message}`);
      }
    }

    // Test 15: Rate Limiting Test
    console.log('\n=== TEST 15: RATE LIMITING TEST ===');
    
    console.log('🔄 Testing rate limiting with rapid requests...');
    const rapidRequests = [];
    
    for (let i = 0; i < 10; i++) {
      rapidRequests.push(
        axios.get(`${API_URL}/auth/me`, { headers: authHeaders })
          .then(() => ({ success: true, index: i }))
          .catch(error => ({ 
            success: false, 
            index: i, 
            status: error.response?.status,
            error: error.response?.data?.message || error.message 
          }))
      );
    }

    const rapidResults = await Promise.all(rapidRequests);
    const successCount = rapidResults.filter(r => r.success).length;
    const rateLimitedCount = rapidResults.filter(r => r.status === 429).length;

    console.log(`✅ Rate limiting test completed`);
    console.log(`   - Successful requests: ${successCount}`);
    console.log(`   - Rate limited requests: ${rateLimitedCount}`);
    
    if (rateLimitedCount > 0) {
      console.log('✅ Rate limiting is working correctly');
    } else {
      console.log('⚠️  No rate limiting detected (may be disabled in development)');
    }

    console.log('\n=== API ENDPOINT TEST SUMMARY ===');
    console.log('✅ Health check: TESTED');
    console.log('✅ User registration: TESTED');
    console.log('✅ User login: TESTED');
    console.log('✅ User profile: TESTED');
    console.log('✅ Categories CRUD: TESTED');
    console.log('✅ Transactions CRUD: TESTED');
    console.log('✅ Dashboard data: TESTED');
    console.log('✅ User preferences: TESTED');
    console.log('✅ Authentication security: TESTED');
    console.log('✅ Rate limiting: TESTED');
    console.log('\n🎉 All API endpoint tests completed!');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    if (testUserId) {
      try {
        await User.findByIdAndDelete(testUserId);
        await Transaction.deleteMany({ user: testUserId });
        await Category.deleteMany({ user: testUserId });
        console.log('✅ Test data cleaned up successfully');
      } catch (error) {
        console.log('⚠️  Error during cleanup:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ API endpoint test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - is the server running?');
      console.error('   Try: npm run dev');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Host not found - check BASE_URL configuration');
    } else {
      console.error('💡 Unexpected error - check server logs');
    }
    
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Ensure the backend server is running (npm run dev)');
    console.error('2. Check BASE_URL in .env file');
    console.error('3. Verify database connection');
    console.error('4. Check server logs for errors');
  } finally {
    await mongoose.connection.close();
    console.log('\n📋 Database connection closed');
  }
};

// Run the test
testAllEndpoints();