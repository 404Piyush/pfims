const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Category = require('../models/Category');
const RefreshToken = require('../models/RefreshToken');
const { auth, sensitiveOperationLimit } = require('../middleware/auth');
const emailService = require('../utils/emailService');
const { rejectedByHIBP } = require('../utils/hibp');
const logger = require('../utils/logger');

const router = express.Router();

const COOKIE_NAME = 'pfims_token';
const REFRESH_COOKIE_NAME = 'pfims_refresh';
const PASSWORD_MIN_LENGTH = 8;
const ACCESS_TTL_SECONDS = parseInt(process.env.ACCESS_TTL_SECONDS || '900', 10); // 15 min
const REFRESH_TTL_SECONDS = parseInt(process.env.REFRESH_TTL_SECONDS || String(30 * 24 * 60 * 60), 10); // 30d
const SAME_SITE = process.env.COOKIE_SAMESITE || 'lax';

// Issue an access token + refresh token for the given user, set the cookies,
// and return the access token. Returns the refresh token so callers can also
// store it in the response body if they need to.
async function issueSession(user, { req, res }) {
  const accessToken = generateToken(user._id);
  const refresh = await RefreshToken.issue({
    user,
    userAgent: req?.headers?.['user-agent'] || '',
    ip: req?.ip,
    ttlSeconds: REFRESH_TTL_SECONDS,
  });
  await refresh.doc.save();

  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refresh.token);

  return { accessToken, refreshToken: refresh.token };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: SAME_SITE,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth', // refresh only travels to /api/auth/* — limits CSRF surface
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

// --- Token helpers -----------------------------------------------
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Decode whichever credential the client sent:
//   1. Authorization: Bearer <jwt>
//   2. pfims_token cookie (httpOnly, set on login)
function readToken(req) {
  const h = req.headers.authorization || req.headers['x-auth-token'];
  if (h && typeof h === 'string') {
    const t = h.toLowerCase().startsWith('bearer ') ? h.slice(7) : h;
    if (t) return t;
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d (aligns with JWT_EXPIRE default)
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.clearCookie('pfims_csrf', { path: '/' });
}

// --- OTP helpers --------------------------------------------------
const OTP_EXP_MINUTES_DEFAULT = parseInt(process.env.OTP_EXP_MINUTES || '10');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
const OTP_RESEND_INTERVAL_MS = parseInt(process.env.OTP_RESEND_INTERVAL_MS || '60000');
// OTP_HASH_ROUNDS lower than password (cost vs UX). 8 is plenty for a 6-digit secret.
const OTP_HASH_ROUNDS = parseInt(process.env.OTP_HASH_ROUNDS || '8');

// Crypto-secure OTP generation.
const generateOtpCode = (length = 6) => {
  const buf = Buffer.alloc(length);
  const out = [];
  for (let i = 0; i < length; i++) {
    crypto.randomFillSync(buf, i, 1);
    out.push(String(buf[i] % 10));
  }
  return out.join('');
};

// Bcrypt-hashed OTP — salt is folded into the hash, so two users with the
// same 6-digit code store different values; still vulnerable to offline
// brute-force only across the OTP space (10^6 / 2 expected attempts).
const hashOtpCode = (code) => bcrypt.hashSync(String(code), OTP_HASH_ROUNDS);
const verifyOtpCode = (code, hash) => bcrypt.compareSync(String(code), hash);

// Exported so middleware/auth.js can honor both header and cookie.
module.exports.readToken = readToken;
module.exports.COOKIE_NAME = COOKIE_NAME;

// --- Password rule ------------------------------------------------
// Was: min 6 chars, no breach check. Now: min 8 chars + at least one
// symbol or special class. (Breach-list check is Phase 2.)
const passwordRule = () =>
  body('password')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .withMessage('Password must contain lowercase, uppercase, digit and a symbol');
const newPasswordRule = () =>
  body('newPassword')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .withMessage('New password must contain lowercase, uppercase, digit and a symbol');

// @route   POST /api/auth/register
router.post(
  '/register',
  [
    body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    passwordRule(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { firstName, lastName, email, password, currency, timezone } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }

      // Reject passwords that appear in known breach corpora.
      const breach = await rejectedByHIBP(password);
      if (breach) {
        return res.status(400).json({
          message: `This password appears in a known data breach (~${breach.count.toLocaleString()} occurrences). Please choose a different one.`,
          code: 'PASSWORD_IN_BREACH',
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

      const user = new User({
        firstName,
        lastName,
        email,
        password,
        currency: currency || 'USD',
        timezone: timezone || 'UTC',
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000,
      });
      await user.save();
      await Category.createDefaultCategories(user._id);

      try {
        const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
        if (!emailResult.success) console.error('Failed to send verification email:', emailResult.error);
      } catch (e) {
        console.error('Email service error:', e);
      }

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
      } catch (e) {
        console.error('Registration OTP send error:', e?.message || e);
      }

      const { accessToken, refreshToken } = await issueSession(user, { req, res });

      res.status(201).json({
        message: 'User registered successfully. Please check your email to verify your account.',
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          currency: user.currency,
          timezone: user.timezone,
          notifications: user.notifications,
          onboarding: user.onboarding,
          investmentProfile: user.investmentProfile,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

// @route   POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

      const { accessToken, refreshToken } = await issueSession(user, { req, res });
      user.lastLogin = new Date();
      await user.save();

      res.json({
        message: 'Login successful',
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          currency: user.currency,
          timezone: user.timezone,
          notifications: user.notifications,
          onboarding: user.onboarding,
          investmentProfile: user.investmentProfile,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

// @route   POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const refreshToken =
    req.cookies && req.cookies[REFRESH_COOKIE_NAME]
      ? req.cookies[REFRESH_COOKIE_NAME]
      : req.body && req.body.refreshToken;
  try {
    await RefreshToken.revoke(refreshToken, 'logout');
  } catch (e) {
    logger.warn({ event: 'logout_revocation_failed', err: e.message }, 'refresh-revoke');
  }
  clearAuthCookie(res);
  clearRefreshCookie(res);
  res.json({ message: 'Logged out' });
});

// @route   POST /api/auth/refresh
// @desc    Rotate the refresh token and mint a new short-lived access token.
//          Cookie-only path (refresh token never leaves the browser on /api/auth/*)
//          Body fallback is supported for first-party migration only.
router.post('/refresh', sensitiveOperationLimit(60 * 1000, 10), async (req, res) => {
  try {
    const presented =
      (req.cookies && req.cookies[REFRESH_COOKIE_NAME]) ||
      (req.body && req.body.refreshToken);
    if (!presented) return res.status(401).json({ message: 'Missing refresh token' });

    const out = await RefreshToken.rotate({
      presentedToken: presented,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
      ttlSeconds: REFRESH_TTL_SECONDS,
    });

    if (out.error === 'reuse_detected') {
      logger.warn({ event: 'refresh_reuse', ip: req.ip }, 'refresh-reuse');
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({
        message: 'Refresh token reuse detected — please log in again.',
        code: 'REFRESH_REUSE',
      });
    }
    if (out.error === 'expired') {
      return res.status(401).json({ message: 'Refresh token expired' });
    }
    if (out.error === 'unknown_token') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(out.doc.user);
    if (!user || !user.isActive) {
      await RefreshToken.revoke(out.token, 'admin');
      return res.status(401).json({ message: 'User not available' });
    }

    const accessToken = generateToken(user._id);
    setAuthCookie(res, accessToken);
    setRefreshCookie(res, out.token);

    res.json({
      message: 'Token refreshed',
      token: accessToken,
      refreshToken: out.token,
    });
  } catch (error) {
    logger.error({ event: 'refresh_error', err: error.message }, 'refresh-failed');
    res.status(500).json({ message: 'Server error during refresh' });
  }
});

// @route   POST /api/auth/otp/send
router.post(
  '/otp/send',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('purpose').isIn(['login', 'register', 'forgot_password']).withMessage('Invalid OTP purpose'),
    body('password').optional().isString().withMessage('Password must be a string'),
  ],
  sensitiveOperationLimit(5 * 60 * 1000, 5),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email, purpose, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      if (!user) return res.json({ message: 'If an account exists, an OTP has been sent.' });
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
      }

      if (user.otpLastSentAt && Date.now() - new Date(user.otpLastSentAt).getTime() < OTP_RESEND_INTERVAL_MS) {
        const waitMs =
          OTP_RESEND_INTERVAL_MS - (Date.now() - new Date(user.otpLastSentAt).getTime());
        return res.status(429).json({ message: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another OTP.` });
      }

      if (purpose === 'login') {
        const isMatch = await user.comparePassword(password || '');
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        if (!user.isEmailVerified) {
          return res.status(401).json({
            message: 'Please verify your email before logging in.',
            requiresEmailVerification: true,
          });
        }
      } else if (purpose === 'register') {
        if (user.isEmailVerified) return res.status(400).json({ message: 'Email is already verified' });
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
  }
);

// @route   POST /api/auth/otp/verify
router.post(
  '/otp/verify',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('code').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
    body('purpose').isIn(['login', 'register', 'forgot_password']).withMessage('Invalid OTP purpose'),
  ],
  sensitiveOperationLimit(5 * 60 * 1000, 10),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email, code, purpose } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

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

      const isValid = verifyOtpCode(code, user.otpCodeHash);
      if (!isValid) {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ message: 'Incorrect OTP' });
      }

      user.otpCodeHash = undefined;
      user.otpPurpose = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      user.otpLastSentAt = undefined;
      user.otpResendCount = 0;

      if (purpose === 'login') {
        const { accessToken, refreshToken } = await issueSession(user, { req, res });
        user.lastLogin = new Date();
        await user.save();
        return res.json({
          message: 'Login successful',
          token: accessToken,
          refreshToken,
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currency: user.currency,
            timezone: user.timezone,
            isEmailVerified: user.isEmailVerified,
            lastLogin: user.lastLogin,
          },
        });
      }

      if (purpose === 'register') {
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        const { accessToken, refreshToken } = await issueSession(user, { req, res });
        user.lastLogin = new Date();
        await user.save();
        return res.json({
          message: 'Email verified successfully',
          token: accessToken,
          refreshToken,
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            currency: user.currency,
            timezone: user.timezone,
            isEmailVerified: user.isEmailVerified,
          },
        });
      }

      if (purpose === 'forgot_password') {
        await user.save();
        return res.json({
          message: 'OTP verified. You may now reset your password using this code.',
          otpVerified: true,
        });
      }

      return res.json({ message: 'OTP verified' });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ message: 'Server error verifying OTP' });
    }
  }
);

// @route   POST /api/auth/reset-password-by-otp
router.post(
  '/reset-password-by-otp',
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('code').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
    newPasswordRule(),
  ],
  sensitiveOperationLimit(15 * 60 * 1000, 3),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email, code, newPassword } = req.body;

      const breach = await rejectedByHIBP(newPassword);
      if (breach) {
        return res.status(400).json({
          message: `This password appears in a known data breach (~${breach.count.toLocaleString()} occurrences). Please choose a different one.`,
          code: 'PASSWORD_IN_BREACH',
        });
      }
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid request' });

      if (
        user.otpPurpose !== 'forgot_password' ||
        !user.otpCodeHash ||
        new Date(user.otpExpires).getTime() < Date.now()
      ) {
        return res.status(400).json({ message: 'Invalid or expired OTP for password reset' });
      }

      if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
        return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
      }

      const isValid = verifyOtpCode(code, user.otpCodeHash);
      if (!isValid) {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ message: 'Incorrect OTP' });
      }

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
  }
);

// @route   GET /api/auth/me
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
        notifications: req.user.notifications,
        onboarding: req.user.onboarding,
        investmentProfile: req.user.investmentProfile,
        isEmailVerified: req.user.isEmailVerified,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  sensitiveOperationLimit(15 * 60 * 1000, 3),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      await user.save();

      try {
        const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);
        if (!emailResult.success) console.error('Failed to send password reset email:', emailResult.error);
      } catch (e) {
        console.error('Email service error:', e);
      }

      res.json({ message: 'If an account with that email exists, a password reset link has been sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    newPasswordRule(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { token, password } = req.body;

      const breach = await rejectedByHIBP(password);
      if (breach) {
        return res.status(400).json({
          message: `This password appears in a known data breach (~${breach.count.toLocaleString()} occurrences). Please choose a different one.`,
          code: 'PASSWORD_IN_BREACH',
        });
      }

      const user = await User.findOne({
        passwordResetToken: crypto.createHash('sha256').update(String(token)).digest('hex'),
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

      user.password = password;
      // Invalidate every refresh token for this user after a password reset.
      try {
        await RefreshToken.revokeAllForUser(user._id, 'password_change');
      } catch (e) {
        // Non-fatal — log only.
      }
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/auth/change-password
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    newPasswordRule(),
  ],
  auth,
  sensitiveOperationLimit(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      const breach = await rejectedByHIBP(newPassword);
      if (breach) {
        return res.status(400).json({
          message: `This password appears in a known data breach (~${breach.count.toLocaleString()} occurrences). Please choose a different one.`,
          code: 'PASSWORD_IN_BREACH',
        });
      }

      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

      user.password = newPassword;
      await user.save();
      // Other sessions become invalid; keep this one logged in only if the
      // caller passes the new (rotation) refresh token.
      try {
        await RefreshToken.revokeAllForUser(user._id, 'password_change');
      } catch (e) {}

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/auth/verify-email
router.post(
  '/verify-email',
  [body('token').notEmpty().withMessage('Verification token is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { token } = req.body;
      const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      });
      if (!user) return res.status(400).json({ message: 'Invalid or expired verification token' });

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      const { accessToken, refreshToken } = await issueSession(user, { req, res });
      user.lastLogin = new Date();
      await user.save();

      res.json({
        message: 'Email verified successfully',
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          currency: user.currency,
          timezone: user.timezone,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/auth/resend-verification
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  sensitiveOperationLimit(15 * 60 * 1000, 3),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.json({ message: 'If an account exists for this email, a verification email has been sent.' });
      if (user.isEmailVerified) return res.status(400).json({ message: 'Email is already verified' });

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      try {
        const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error);
          return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' });
        }
      } catch (e) {
        console.error('Email service error:', e);
        return res.status(500).json({ message: 'Failed to send verification email. Please try again later.' });
      }

      return res.json({ message: 'Verification email sent successfully.' });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
