const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, sensitiveOperationLimit } = require('../middleware/auth');
const emailService = require('../utils/emailService');

const router = express.Router();

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid timezone')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = [
      'firstName', 
      'lastName', 
      'phone', 
      'dateOfBirth', 
      'currency', 
      'timezone'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        currency: user.currency,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Server error during profile update'
    });
  }
});

// @route   PUT /api/users/email
// @desc    Update user email
// @access  Private
router.put('/email', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required to change email')
], auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if email is already taken
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        message: 'Email is already in use'
      });
    }

    // Get user with password for verification
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Incorrect password'
      });
    }

    // Update email and reset verification status
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    user.email = email;
    user.isEmailVerified = false;
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Send verification email to new address
    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Continue with success response as email was updated
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue with success response as email was updated
    }

    res.json({
      message: 'Email updated successfully. Please check your new email address for verification.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Email update error:', error);
    res.status(500).json({
      message: 'Server error during email update'
    });
  }
});

// @route   POST /api/users/resend-verification
// @desc    Resend email verification
// @access  Private
router.post('/resend-verification', auth, sensitiveOperationLimit(15 * 60 * 1000, 3), async (req, res) => {
  try {
    if (req.user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is already verified'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();
    
    // Send verification email
    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return res.status(500).json({
          message: 'Failed to send verification email. Please try again later.'
        });
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      return res.status(500).json({
        message: 'Failed to send verification email. Please try again later.'
      });
    }
    
    res.json({
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', [
  body('password')
    .notEmpty()
    .withMessage('Password is required to deactivate account'),
  body('confirmation')
    .equals('DELETE')
    .withMessage('Please type DELETE to confirm account deactivation')
], auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password } = req.body;

    // Get user with password for verification
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Incorrect password'
      });
    }

    // Deactivate account instead of deleting
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Account deactivation error:', error);
    res.status(500).json({
      message: 'Server error during account deactivation'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user account statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const Budget = require('../models/Budget');
    const Category = require('../models/Category');

    const [
      transactionCount,
      budgetCount,
      categoryCount,
      recentTransactions
    ] = await Promise.all([
      Transaction.countDocuments({ user: req.user._id }),
      Budget.countDocuments({ user: req.user._id, isActive: true }),
      Category.countDocuments({ user: req.user._id, isActive: true }),
      Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('category', 'name color icon')
    ]);

    // Calculate total income and expenses for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalTransactions: transactionCount,
      activeBudgets: budgetCount,
      totalCategories: categoryCount,
      accountAge: Math.floor((Date.now() - req.user.createdAt) / (1000 * 60 * 60 * 24)),
      monthlyStats: monthlyStats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.total,
          count: stat.count
        };
        return acc;
      }, {}),
      recentTransactions
    };

    res.json({
      message: 'User statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      message: 'Server error retrieving statistics'
    });
  }
});

module.exports = router;