const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

// Import models
const User = require('../models/User');

async function resetPassword() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
        console.log('✅ Connected to MongoDB');

        // Find the user
        const user = await User.findOne({ email: 'piyush@gmail.com' });
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('✅ User found:', user.email);

        // Hash the new password
        const newPassword = 'password123';
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        console.log('🔐 Setting new password:', newPassword);
        console.log('🔐 New password hash:', hashedPassword);

        // Update the user's password
        await User.findByIdAndUpdate(user._id, { 
            password: hashedPassword 
        });

        console.log('✅ Password updated successfully!');

        // Verify the password works
        const updatedUser = await User.findOne({ email: 'piyush@gmail.com' }).select('+password');
        const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
        
        if (isMatch) {
            console.log('✅ Password verification successful!');
        } else {
            console.log('❌ Password verification failed!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

resetPassword();