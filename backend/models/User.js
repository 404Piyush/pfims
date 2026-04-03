const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    transactionAlerts: {
      type: Boolean,
      default: false
    },
    budgetAlerts: {
      type: Boolean,
      default: true
    },
    weeklyReports: {
      type: Boolean,
      default: false
    },
    monthlyReports: {
      type: Boolean,
      default: false
    }
  },
  onboarding: {
    investmentProfileCompleted: {
      type: Boolean,
      default: false
    },
    investmentProfileCompletedAt: Date
  },
  investmentProfile: {
    answers: {
      riskTolerance: {
        type: Number,
        min: 1,
        max: 4
      },
      investmentDuration: {
        type: Number,
        min: 1,
        max: 4
      },
      savingsCapacity: {
        type: Number,
        min: 1,
        max: 4
      },
      financialGoal: {
        type: Number,
        min: 1,
        max: 4
      },
      financialGoals: [
        {
          type: Number,
          min: 1,
          max: 4
        }
      ],
      age: {
        type: Number,
        min: 0,
        max: 150
      },
      hasEmergencyFund: Boolean,
      hasHighInterestDebt: Boolean
    },
    score: Number,
    profile: {
      type: String,
      enum: ['Conservative', 'Moderate', 'Aggressive']
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'blocked'],
      default: 'success'
    },
    allocation: {
      largeCap: Number,
      midCap: Number,
      smallCap: Number,
      bonds: Number,
      liquidFund: Number
    },
    explanation: String,
    updatedAt: Date
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  // OTP fields for multi-factor/login/verification and password reset via OTP
  otpCodeHash: String,
  otpPurpose: {
    type: String,
    enum: ['login', 'register', 'forgot_password'],
  },
  otpExpires: Date,
  otpAttempts: {
    type: Number,
    default: 0
  },
  otpLastSentAt: Date,
  otpResendCount: {
    type: Number,
    default: 0
  },
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  integrations: {
    groww: {
      apiKeyEnc: {
        type: String,
        default: ''
      },
      apiSecretEnc: {
        type: String,
        default: ''
      },
      accounts: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          apiKeyEnc: { type: String, default: '' },
          apiSecretEnc: { type: String, default: '' },
          createdAt: { type: Date, default: Date.now },
          updatedAt: Date,
        },
      ],
      updatedAt: Date
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
// Note: email field already has unique: true, so no need for separate index
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name virtual
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Transform output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.otpCodeHash;
  delete user.otpPurpose;
  delete user.otpExpires;
  delete user.otpAttempts;
  delete user.otpLastSentAt;
  delete user.otpResendCount;
  delete user.integrations;
  return user;
};

module.exports = mongoose.model('User', userSchema);
