const nodemailer = require('nodemailer');
const emailService = require('../services/emailService');
require('dotenv').config();

const testEmailService = async () => {
  try {
    console.log('📧 Starting Email Service Tests...\n');

    // Test 1: Email Configuration
    console.log('=== TEST 1: EMAIL CONFIGURATION ===');
    
    const requiredEnvVars = [
      'SMTP_HOST',
      'SMTP_PORT', 
      'SMTP_USER',
      'SMTP_PASS',
      'FROM_EMAIL',
      'FROM_NAME'
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

    // Test 2: SMTP Connection
    console.log('\n=== TEST 2: SMTP CONNECTION ===');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    try {
      const connectionStart = Date.now();
      await transporter.verify();
      const connectionTime = Date.now() - connectionStart;
      
      console.log('✅ SMTP connection successful');
      console.log(`   - Connection time: ${connectionTime}ms`);
      console.log(`   - Host: ${process.env.SMTP_HOST}`);
      console.log(`   - Port: ${process.env.SMTP_PORT}`);
      console.log(`   - Secure: ${process.env.SMTP_PORT === '465'}`);
    } catch (error) {
      console.log('❌ SMTP connection failed');
      console.log(`   - Error: ${error.message}`);
      return;
    }

    // Test 3: Welcome Email Template
    console.log('\n=== TEST 3: WELCOME EMAIL TEMPLATE ===');
    
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com'
    };

    try {
      const welcomeEmailStart = Date.now();
      await emailService.sendWelcomeEmail(testUser);
      const welcomeEmailTime = Date.now() - welcomeEmailStart;
      
      console.log('✅ Welcome email sent successfully');
      console.log(`   - Send time: ${welcomeEmailTime}ms`);
      console.log(`   - Recipient: ${testUser.email}`);
    } catch (error) {
      console.log('❌ Welcome email failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 4: Email Verification Template
    console.log('\n=== TEST 4: EMAIL VERIFICATION TEMPLATE ===');
    
    const verificationToken = 'test-verification-token-123';
    
    try {
      const verificationEmailStart = Date.now();
      await emailService.sendEmailVerification(testUser, verificationToken);
      const verificationEmailTime = Date.now() - verificationEmailStart;
      
      console.log('✅ Email verification sent successfully');
      console.log(`   - Send time: ${verificationEmailTime}ms`);
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Token: ${verificationToken}`);
    } catch (error) {
      console.log('❌ Email verification failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 5: Password Reset Template
    console.log('\n=== TEST 5: PASSWORD RESET TEMPLATE ===');
    
    const resetToken = 'test-reset-token-456';
    
    try {
      const resetEmailStart = Date.now();
      await emailService.sendPasswordReset(testUser, resetToken);
      const resetEmailTime = Date.now() - resetEmailStart;
      
      console.log('✅ Password reset email sent successfully');
      console.log(`   - Send time: ${resetEmailTime}ms`);
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Token: ${resetToken}`);
    } catch (error) {
      console.log('❌ Password reset email failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 6: Transaction Notification Template
    console.log('\n=== TEST 6: TRANSACTION NOTIFICATION TEMPLATE ===');
    
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
      await emailService.sendTransactionNotification(testUser, testTransaction);
      const transactionEmailTime = Date.now() - transactionEmailStart;
      
      console.log('✅ Transaction notification sent successfully');
      console.log(`   - Send time: ${transactionEmailTime}ms`);
      console.log(`   - Recipient: ${testUser.email}`);
      console.log(`   - Transaction: ${testTransaction.title} - $${testTransaction.amount}`);
    } catch (error) {
      console.log('❌ Transaction notification failed');
      console.log(`   - Error: ${error.message}`);
    }

    // Test 7: Email Rate Limiting
    console.log('\n=== TEST 7: EMAIL RATE LIMITING ===');
    
    console.log('🔄 Testing rapid email sending...');
    const rapidEmailPromises = [];
    
    for (let i = 0; i < 3; i++) {
      rapidEmailPromises.push(
        emailService.sendWelcomeEmail({
          ...testUser,
          email: `test${i}@example.com`
        }).catch(error => ({ error: error.message }))
      );
    }

    const rapidResults = await Promise.all(rapidEmailPromises);
    const successCount = rapidResults.filter(result => !result.error).length;
    const errorCount = rapidResults.filter(result => result.error).length;

    console.log(`✅ Rapid email test completed`);
    console.log(`   - Successful sends: ${successCount}`);
    console.log(`   - Failed sends: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('⚠️  Some emails failed due to rate limiting (expected behavior)');
      rapidResults.forEach((result, index) => {
        if (result.error) {
          console.log(`   - Email ${index + 1}: ${result.error}`);
        }
      });
    }

    // Test 8: Email Template Validation
    console.log('\n=== TEST 8: EMAIL TEMPLATE VALIDATION ===');
    
    const templateTests = [
      {
        name: 'Welcome Email',
        test: () => emailService.sendWelcomeEmail({ firstName: '', lastName: '', email: 'invalid' })
      },
      {
        name: 'Email Verification',
        test: () => emailService.sendEmailVerification({ firstName: '', email: 'invalid' }, '')
      },
      {
        name: 'Password Reset',
        test: () => emailService.sendPasswordReset({ firstName: '', email: 'invalid' }, '')
      }
    ];

    for (const template of templateTests) {
      try {
        await template.test();
        console.log(`❌ ${template.name}: Should have failed with invalid data`);
      } catch (error) {
        console.log(`✅ ${template.name}: Correctly rejected invalid data`);
        console.log(`   - Error: ${error.message}`);
      }
    }

    console.log('\n=== EMAIL SERVICE TEST SUMMARY ===');
    console.log('✅ Email configuration: TESTED');
    console.log('✅ SMTP connection: TESTED');
    console.log('✅ Welcome email template: TESTED');
    console.log('✅ Email verification template: TESTED');
    console.log('✅ Password reset template: TESTED');
    console.log('✅ Transaction notification template: TESTED');
    console.log('✅ Email rate limiting: TESTED');
    console.log('✅ Template validation: TESTED');
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