const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Category = require('../models/Category');
const { auth, sensitiveOperationLimit } = require('../middleware/auth');
const emailService = require('../utils/emailService');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// OTP helpers
const OTP_EXP_MINUTES_DEFAULT = parseInt(process.env.OTP_EXP_MINUTES || '10');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
const OTP_RESEND_INTERVAL_MS = parseInt(process.env.OTP_RESEND_INTERVAL_MS || '60000');

const generateOtpCode = (length = 6) => {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
};

const hashOtpCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, currency, timezone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email'
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      currency: currency || 'USD',
      timezone: timezone || 'UTC',
      isEmailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    await user.save();

    // Create default categories for the user
    await Category.createDefaultCategories(user._id);

    // Send verification email
    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Continue with registration success
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue with registration success
    }

    // Additionally send OTP for new account verification (alternate to link)
    try {
      const otpCode = generateOtpCode(6);
      user.otpCodeHash = hashOtpCode(otpCode);
      user.otpPurpose = 'register';
      user.otpExpires = new Date(Date.now() + OTP_EXP_MINUTES_DEFAULT * 60 * 1000);
      user.otpAttempts = 0;
      user.otpLastSentAt = new Date();
      user.otpResendCount = (user.otpResendCount || 0) + 1;
      await user.save();
      await emailService.sendOtpEmail(user.email, otpCode, OTP_EXP_MINUTES_DEFAULT);
    } catch (otpError) {
      console.error('Registration OTP send error:', otpError?.message || otpError);
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresEmailVerification: true
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/otp/send
// @desc    Send OTP for login, registration verification, or forgot password
// @access  Public (login requires password verification)
router.post('/otp/send', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('purpose').isIn(['login', 'register', 'forgot_password']).withMessage('Invalid OTP purpose'),
  body('password').optional().isString().withMessage('Password must be a string')
], sensitiveOperationLimit(5 * 60 * 1000, 5), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { email, purpose, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Do not reveal existence of account
      return res.json({ message: 'If an account exists, an OTP has been sent.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
    }

    // Rate-limit resend by interval
    if (user.otpLastSentAt && Date.now() - new Date(user.otpLastSentAt).getTime() < OTP_RESEND_INTERVAL_MS) {
      const waitMs = OTP_RESEND_INTERVAL_MS - (Date.now() - new Date(user.otpLastSentAt).getTime());
      return res.status(429).json({ message: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another OTP.` });
    }

    if (purpose === 'login') {
      // Verify password before sending OTP as second factor
      const isMatch = await user.comparePassword(password || '');
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      if (!user.isEmailVerified) {
        return res.status(401).json({ message: 'Please verify your email before logging in.', requiresEmailVerification: true });
      }
    } else if (purpose === 'register') {
      if (user.isEmailVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }
    } else if (purpose === 'forgot_password') {
      // No extra checks – keep behavior generic
    }

    const otpCode = generateOtpCode(6);
    user.otpCodeHash = hashOtpCode(otpCode);
    user.otpPurpose = purpose;
    user.otpExpires = new Date(Date.now() + OTP_EXP_MINUTES_DEFAULT * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    user.otpResendCount = (user.otpResendCount || 0) + 1;
    await user.save();

    const result = await emailService.sendOtpEmail(user.email, otpCode, OTP_EXP_MINUTES_DEFAULT);
    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send OTP', error: result.error });
    }

    return res.json({ message: 'OTP has been sent. Please check your email.', purpose });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error sending OTP' });
  }
});

// @route   POST /api/auth/otp/verify
// @desc    Verify OTP for login, registration, or forgot password
// @access  Public
router.post('/otp/verify', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('code').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
  body('purpose').isIn(['login', 'register', 'forgot_password']).withMessage('Invalid OTP purpose')
], sensitiveOperationLimit(5 * 60 * 1000, 10), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { email, code, purpose } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (!user.otpCodeHash || !user.otpPurpose || !user.otpExpires) {
      return res.status(400).json({ message: 'No active OTP. Please request a new code.' });
    }

    if (user.otpPurpose !== purpose) {
      return res.status(400).json({ message: 'OTP purpose mismatch. Please request a new code.' });
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
    }

    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashed = hashOtpCode(code);
    const isValid = hashed === user.otpCodeHash;
    if (!isValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    // Success: clear OTP fields
    user.otpCodeHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpLastSentAt = undefined;
    user.otpResendCount = 0;

    if (purpose === 'login') {
      // Complete login
      const token = generateToken(user._id);
      user.lastLogin = new Date();
      await user.save();
      return res.json({ message: 'Login successful', token, user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin
      }});
    }

    if (purpose === 'register') {
      // Verify email via OTP
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      const token = generateToken(user._id);
      user.lastLogin = new Date();
      await user.save();
      return res.json({ message: 'Email verified successfully', token, user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified
      }});
    }

    if (purpose === 'forgot_password') {
      await user.save();
      return res.json({ message: 'OTP verified. You may now reset your password using this code.', otpVerified: true });
    }

    return res.json({ message: 'OTP verified' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error verifying OTP' });
  }
});

// @route   POST /api/auth/reset-password-by-otp
// @desc    Reset password using OTP (alternative to email token flow)
// @access  Public
router.post('/reset-password-by-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('code').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], sensitiveOperationLimit(15 * 60 * 1000, 3), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (user.otpPurpose !== 'forgot_password' || !user.otpCodeHash || new Date(user.otpExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP for password reset' });
    }

    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashed = hashOtpCode(code);
    const isValid = hashed === user.otpCodeHash;
    if (!isValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.otpCodeHash = undefined;
    user.otpPurpose = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpLastSentAt = undefined;
    user.otpResendCount = 0;
    await user.save();

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password by OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        currency: req.user.currency,
        timezone: req.user.timezone,
        isEmailVerified: req.user.isEmailVerified,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], sensitiveOperationLimit(15 * 60 * 1000, 3), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Send password reset email
    try {
      const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Continue with success response for security (don't reveal email sending failures)
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue with success response for security
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.json({
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password (authenticated)
// @access  Private
router.post('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email with token
// @access  Public
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token } = req.body;

    // Hash the token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({ 
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token'
      });
    }

    // Verify email and clear verification fields
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Generate token for immediate login
    const authToken = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Email verified successfully',
      token: authToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

router.post('/resend-verification', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
], sensitiveOperationLimit(15 * 60 * 1000, 3), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    // Always respond generically to avoid email enumeration
    if (!user) {
      return res.json({
        message: 'If an account exists for this email, a verification email has been sent.'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' });
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' });
    }

    return res.json({ message: 'Verification email sent successfully.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;