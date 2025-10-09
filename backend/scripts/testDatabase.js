const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
require('dotenv').config();

const testDatabase = async () => {
  try {
    console.log('🗄️  Starting Database Health Check...\n');

    // Test MongoDB connection
    console.log('=== DATABASE CONNECTION ===');
    const startTime = Date.now();
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    const connectionTime = Date.now() - startTime;
    
    console.log('✅ MongoDB connected successfully');
    console.log(`   - Connection time: ${connectionTime}ms`);
    console.log(`   - Database: ${mongoose.connection.name}`);
    console.log(`   - Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    console.log(`   - Ready state: ${mongoose.connection.readyState} (1 = connected)`);

    // Test database operations
    console.log('\n=== DATABASE OPERATIONS ===');

    // Count documents in each collection
    const userCount = await User.countDocuments();
    const categoryCount = await Category.countDocuments();
    const transactionCount = await Transaction.countDocuments();
    const accountCount = await Account.countDocuments();

    console.log('📊 Collection Statistics:');
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Categories: ${categoryCount}`);
    console.log(`   - Transactions: ${transactionCount}`);
    console.log(`   - Accounts: ${accountCount}`);

    // Test write operation
    console.log('\n=== WRITE OPERATION TEST ===');
    const testDoc = {
      firstName: 'DB',
      lastName: 'Test',
      email: `dbtest${Date.now()}@example.com`,
      password: 'hashedpassword',
      isEmailVerified: true,
      isActive: true,
      currency: 'USD',
      timezone: 'UTC'
    };

    const writeStartTime = Date.now();
    const createdUser = await User.create(testDoc);
    const writeTime = Date.now() - writeStartTime;

    console.log('✅ Write operation successful');
    console.log(`   - Write time: ${writeTime}ms`);
    console.log(`   - Created user ID: ${createdUser._id}`);

    // Test read operation
    console.log('\n=== READ OPERATION TEST ===');
    const readStartTime = Date.now();
    const foundUser = await User.findById(createdUser._id);
    const readTime = Date.now() - readStartTime;

    console.log('✅ Read operation successful');
    console.log(`   - Read time: ${readTime}ms`);
    console.log(`   - Found user: ${foundUser.email}`);

    // Test update operation
    console.log('\n=== UPDATE OPERATION TEST ===');
    const updateStartTime = Date.now();
    await User.findByIdAndUpdate(createdUser._id, { firstName: 'Updated' });
    const updateTime = Date.now() - updateStartTime;

    console.log('✅ Update operation successful');
    console.log(`   - Update time: ${updateTime}ms`);

    // Test delete operation
    console.log('\n=== DELETE OPERATION TEST ===');
    const deleteStartTime = Date.now();
    await User.findByIdAndDelete(createdUser._id);
    const deleteTime = Date.now() - deleteStartTime;

    console.log('✅ Delete operation successful');
    console.log(`   - Delete time: ${deleteTime}ms`);

    // Test indexes
    console.log('\n=== INDEX INFORMATION ===');
    const userIndexes = await User.collection.getIndexes();
    const categoryIndexes = await Category.collection.getIndexes();
    
    console.log('📋 User Collection Indexes:');
    Object.keys(userIndexes).forEach(indexName => {
      console.log(`   - ${indexName}: ${JSON.stringify(userIndexes[indexName])}`);
    });

    console.log('📋 Category Collection Indexes:');
    Object.keys(categoryIndexes).forEach(indexName => {
      console.log(`   - ${indexName}: ${JSON.stringify(categoryIndexes[indexName])}`);
    });

    // Test aggregation
    console.log('\n=== AGGREGATION TEST ===');
    const aggStartTime = Date.now();
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);
    const aggTime = Date.now() - aggStartTime;

    if (userStats.length > 0) {
      console.log('✅ Aggregation operation successful');
      console.log(`   - Aggregation time: ${aggTime}ms`);
      console.log(`   - Total users: ${userStats[0].totalUsers}`);
      console.log(`   - Verified users: ${userStats[0].verifiedUsers}`);
      console.log(`   - Active users: ${userStats[0].activeUsers}`);
    } else {
      console.log('✅ Aggregation operation successful (no data)');
      console.log(`   - Aggregation time: ${aggTime}ms`);
    }

    // Performance summary
    console.log('\n=== PERFORMANCE SUMMARY ===');
    console.log(`⚡ Connection: ${connectionTime}ms`);
    console.log(`⚡ Write: ${writeTime}ms`);
    console.log(`⚡ Read: ${readTime}ms`);
    console.log(`⚡ Update: ${updateTime}ms`);
    console.log(`⚡ Delete: ${deleteTime}ms`);
    console.log(`⚡ Aggregation: ${aggTime}ms`);

    const avgTime = (writeTime + readTime + updateTime + deleteTime + aggTime) / 5;
    console.log(`📊 Average operation time: ${avgTime.toFixed(2)}ms`);

    if (avgTime < 50) {
      console.log('🚀 Database performance: EXCELLENT');
    } else if (avgTime < 100) {
      console.log('✅ Database performance: GOOD');
    } else if (avgTime < 200) {
      console.log('⚠️  Database performance: FAIR');
    } else {
      console.log('🐌 Database performance: SLOW');
    }

    console.log('\n🎉 Database health check completed successfully!');

  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    
    if (error.name === 'MongoNetworkError') {
      console.error('💡 Network error - check MongoDB connection string and network connectivity');
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Server selection error - MongoDB server may be down or unreachable');
    } else if (error.name === 'MongoParseError') {
      console.error('💡 Connection string parse error - check MONGODB_URI format');
    } else {
      console.error('💡 Unexpected error - check MongoDB server status and configuration');
    }
    
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Verify MongoDB is running');
    console.error('2. Check MONGODB_URI in .env file');
    console.error('3. Verify network connectivity');
    console.error('4. Check MongoDB server logs');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('📊 Database connection closed');
    }
  }
};

// Run the test
testDatabase();