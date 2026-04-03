require('dotenv').config();
const emailService = require('../utils/emailService');

async function testPasswordResetEmail() {
  try {
    console.log('🧪 Testing Password Reset Email...');
    
    // Test user data
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      _id: '507f1f77bcf86cd799439011'
    };
    
    const resetToken = 'test-reset-token-456';
    
    console.log('📧 Sending password reset email...');
    
    const result = await emailService.sendPasswordResetEmail(testUser, resetToken);
    
    if (result.success) {
      console.log('✅ Password reset email sent successfully!');
      console.log(`📬 Check ${process.env.EMAIL_FROM || process.env.EMAIL_USER} for the password reset email status`);
      console.log('🔗 Reset link includes token:', resetToken);
    } else {
      console.log('❌ Failed to send password reset email:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPasswordResetEmail();
