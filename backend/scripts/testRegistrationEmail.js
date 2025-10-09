require('dotenv').config();
const mongoose = require('mongoose');
const emailService = require('../utils/emailService');

async function testRegistrationEmail() {
  try {
    console.log('🧪 Testing User Registration Email...');
    
    // Test user data
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      _id: '507f1f77bcf86cd799439011'
    };
    
    const verificationToken = 'test-verification-token-123';
    
    console.log('📧 Sending verification email...');
    
    const result = await emailService.sendVerificationEmail(testUser, verificationToken);
    
    if (result.success) {
      console.log('✅ Registration email sent successfully!');
      console.log('📬 Check your Mailtrap inbox for the verification email');
      console.log('🔗 Verification link includes token:', verificationToken);
    } else {
      console.log('❌ Failed to send registration email:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRegistrationEmail();