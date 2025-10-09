const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUserEmailVerification() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
        console.log('✅ Connected to MongoDB');

        // Find the user
        const user = await User.findOne({ email: 'piyush@gmail.com' });
        
        if (!user) {
            console.log('❌ User piyush@gmail.com not found');
            return;
        }

        console.log('\n👤 User Details:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Email Verified: ${user.isEmailVerified}`);
        console.log(`   Account Active: ${user.isActive}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
        
        if (!user.isEmailVerified) {
            console.log('\n⚠️  EMAIL NOT VERIFIED - This is why login is failing!');
            console.log('   The login route requires email verification.');
            
            // Check if verification token exists
            if (user.emailVerificationToken) {
                console.log('   Verification token exists');
                console.log(`   Token expires: ${user.emailVerificationExpires}`);
                
                if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
                    console.log('   ❌ Verification token has EXPIRED');
                } else {
                    console.log('   ✅ Verification token is still valid');
                }
            } else {
                console.log('   ❌ No verification token found');
            }
        } else {
            console.log('\n✅ Email is verified - login should work');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

checkUserEmailVerification();