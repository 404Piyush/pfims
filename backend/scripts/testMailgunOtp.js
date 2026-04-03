require('dotenv').config();
const emailService = require('../utils/emailService');

async function main() {
  try {
    console.log('Testing Gmail SMTP OTP email sending...');
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Gmail SMTP credentials are not configured in .env');
      process.exit(1);
    }

    const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_USER;
    const otp = '123456';
    const expires = 10;

    const res = await emailService.sendOtpEmail(to, otp, expires);
    console.log('Result:', res);
    console.log(`OTP email attempted from ${process.env.EMAIL_FROM || process.env.EMAIL_USER} to ${to}`);
  } catch (err) {
    console.error('Error sending OTP email:', err.message);
  }
}

main();
