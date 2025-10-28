require('dotenv').config();
const emailService = require('../utils/emailService');

async function main() {
  try {
    console.log('Testing Mailgun OTP email sending...');
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      console.error('Mailgun not configured in .env');
      process.exit(1);
    }

    const to = process.env.TEST_MAILGUN_TO || 'piyushutkarxb@gmail.com';
    const otp = '123456';
    const expires = 10;

    const res = await emailService.sendOtpEmail(to, otp, expires);
    console.log('Result:', res);
    console.log('If using Mailgun sandbox, ensure recipient is authorized.');
  } catch (err) {
    console.error('Error sending OTP email:', err.message);
  }
}

main();