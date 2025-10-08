const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

// Import models
const User = require('../models/User');

async function testLogin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
        console.log('✅ Connected to MongoDB');

        // Find the user (explicitly select password field)
        const user = await User.findOne({ email: 'piyush@gmail.com' }).select('+password');
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('✅ User found:', user.email);
        console.log('📧 Email:', user.email);
        console.log('👤 Name:', user.name);
        console.log('🔐 Password Hash:', user.password);
        console.log('📅 Created:', user.createdAt);

        // Test password verification
        const testPassword = 'password123';
        console.log('\n🔍 Testing password:', testPassword);
        
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log('🔐 Password match result:', isMatch);

        if (isMatch) {
            console.log('✅ Password is correct!');
        } else {
            console.log('❌ Password does not match!');
            
            // Let's also try some other common passwords
            const commonPasswords = ['password', '123456', 'admin', 'piyush123'];
            console.log('\n🔍 Testing other common passwords...');
            
            for (const pwd of commonPasswords) {
                const match = await bcrypt.compare(pwd, user.password);
                console.log(`   ${pwd}: ${match ? '✅ MATCH' : '❌ No match'}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

testLogin();