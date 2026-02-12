require('dotenv').config();
const emailService = require('../utils/emailService');

const testEmailService = async () => {
  try {
    console.log('📧 Starting Email Service Tests...\n');

    // Test 1: Email Configuration
    console.log('=== TEST 1: EMAIL CONFIGURATION ===');
    
    const requiredEnvVars = [
      'EMAIL_HOST',
      'EMAIL_PORT', 
      'EMAIL_USER',
      'EMAIL_PASS'
    ];

    let configValid = true;
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: Set`);
      } else {
        console.log(`❌ ${envVar}: Missing`);
        configValid = false;
      }
    });

    if (configValid) {
      console.log('✅ Email configuration is complete');
    } else {
      console.log('❌ Email configuration is incomplete');
      return;
    }

    // Test 2: Email Server Connection
    console.log('\n=== TEST 2: SMTP CONNECTION ===');
    
    try {
      const connectionStart = Date.now();
      const ok = await emailService.verifyConnection();
      const connectionTime = Date.now() - connectionStart;
      
      if (!ok) {
        console.log('❌ SMTP connection failed');
        return;
      }

      console.log('✅ SMTP connection successful');
      console.log(`   - Connection time: ${connectionTime}ms`);
      console.log(`   - Host: ${process.env.EMAIL_HOST}`);
      console.log(`   - Port: ${process.env.EMAIL_PORT}`);
      console.log(`   - Secure: ${process.env.EMAIL_SECURE === 'true'}`);
    } catch (error) {
      console.log('❌ SMTP connection failed');
      console.log(`   - Error: ${error.message}`);
      return;
    }

    // Test 3: Email Verification Template
    console.log('\n=== TEST 3: EMAIL VERIFICATION TEMPLATE ===');
    
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com'
    };

    try {
      const verificationToken = 'test-verification-token-123';
      const verificationEmailStart = Date.now();
      const result = await emailService.sendVerificationEmail(testUser, verificationToken);
      const verificationEmailTime = Date.now() - verificationEmailStart;
      
      if (!result?.success) {
        console.log('❌ Email verification failed');
        console.log(`   - Error: ${result?.error || 'Unknown error'}`);
      } else {
        console.log('✅ Email verification sent successfully');
        console.log(`   - Send time: ${verificationEmailTime}ms`);
      }
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Token: ${verificationToken}`);
    } catch (error) {
      console.log('❌ Email verification failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 4: Password Reset Template
    console.log('\n=== TEST 4: PASSWORD RESET TEMPLATE ===');
    
    const resetToken = 'test-reset-token-456';
    
    try {
      const resetEmailStart = Date.now();
      const result = await emailService.sendPasswordReset(testUser, resetToken);
      const resetEmailTime = Date.now() - resetEmailStart;
      
      if (!result?.success) {
        console.log('❌ Password reset email failed');
        console.log(`   - Error: ${result?.error || 'Unknown error'}`);
      } else {
        console.log('✅ Password reset email sent successfully');
        console.log(`   - Send time: ${resetEmailTime}ms`);
      }
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Token: ${resetToken}`);
    } catch (error) {
      console.log('❌ Password reset email failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 5: Transaction Notification Template
    console.log('\n=== TEST 5: TRANSACTION NOTIFICATION TEMPLATE ===');
    
    const testTransaction = {
      title: 'Test Transaction',
      amount: 100.50,
      type: 'expense',
      category: 'Food',
      paymentMethod: 'credit_card',
      date: new Date(),
      account: 'Main Account'
    };
    
    try {
      const transactionEmailStart = Date.now();
      const result = await emailService.sendTransactionNotificationEmail(testUser, testTransaction);
      const transactionEmailTime = Date.now() - transactionEmailStart;
      
      if (!result?.success) {
        console.log('❌ Transaction notification failed');
        console.log(`   - Error: ${result?.error || 'Unknown error'}`);
      } else {
        console.log('✅ Transaction notification sent successfully');
        console.log(`   - Send time: ${transactionEmailTime}ms`);
      }
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Transaction: ${testTransaction.title} - $${testTransaction.amount}`);
    } catch (error) {
      console.log('❌ Transaction notification failed');
      console.log(`   - Error: ${error.message}`);
    }

    console.log('\n=== EMAIL SERVICE TEST SUMMARY ===');
    console.log('✅ Email configuration: TESTED');
    console.log('✅ SMTP connection: TESTED');
    console.log('✅ Email verification template: TESTED');
    console.log('✅ Password reset template: TESTED');
    console.log('✅ Transaction notification template: TESTED');
    console.log('\n🎉 Email service tests completed!');

    console.log('\n📋 Email Service Status:');
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development Mode: Emails sent to Mailtrap');
      console.log('💡 Check your Mailtrap inbox for test emails');
    } else {
      console.log('🚀 Production Mode: Emails sent to real recipients');
      console.log('⚠️  Be careful with test emails in production');
    }

  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('💡 Authentication error - check SMTP credentials');
    } else if (error.code === 'ECONNECTION') {
      console.error('💡 Connection error - check SMTP host and port');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('💡 Timeout error - check network connectivity');
    } else {
      console.error('💡 Unexpected error - check email service configuration');
    }
    
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Verify SMTP credentials in .env file');
    console.error('2. Check SMTP server status');
    console.error('3. Verify network connectivity');
    console.error('4. Check email service provider settings');
  }
};

// Run the test
testEmailService();
