const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Determine environment and whether to disable rate limiting
const isDevEnv = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
const disableRateLimit = isDevEnv || String(process.env.DISABLE_RATE_LIMIT).toLowerCase() === 'true';
const noopMiddleware = (req, res, next) => next();

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * Create rate limiter for specific endpoints
 */
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Create slow down middleware for specific endpoints
 */
const createSlowDown = (windowMs = 15 * 60 * 1000, delayAfter = 50, delay = 500) => {
  return slowDown({
    windowMs,
    delayAfter,
    delay, // Use 'delay' instead of 'delayMs' for newer versions
    maxDelayMs: 20000, // Maximum delay of 20 seconds
  });
};

/**
 * Strict rate limiting for authentication endpoints
 */
// Disable strict auth rate limiting in development/test unless explicitly enabled
const authRateLimit = disableRateLimit
  ? noopMiddleware
  : createRateLimit(
      15 * 60 * 1000, // 15 minutes
      5, // 5 attempts per window
      'Too many authentication attempts, please try again later'
    );

/**
 * Moderate rate limiting for API endpoints
 */
// Disable general API rate limiting in development/test unless explicitly enabled
const apiRateLimit = disableRateLimit
  ? noopMiddleware
  : createRateLimit(
      15 * 60 * 1000, // 15 minutes
      100, // 100 requests per window
      'Too many API requests, please try again later'
    );

/**
 * Slow down for expensive operations
 */
const expensiveOperationSlowDown = createSlowDown(
  15 * 60 * 1000, // 15 minutes
  10, // Start slowing down after 10 requests
  1000 // 1 second delay
);

/**
 * Sanitize request data
 */
const sanitizeRequest = (req, res, next) => {
  // Remove any null bytes
  const sanitizeString = (str) => {
    if (typeof str === 'string') {
      return str.replace(/\0/g, '');
    }
    return str;
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);

  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Ensure reasonable limits
  req.query.page = Math.max(1, page);
  req.query.limit = Math.min(Math.max(1, limit), 100);

  next();
};

module.exports = {
  handleValidationErrors,
  createRateLimit,
  createSlowDown,
  authRateLimit,
  apiRateLimit,
  expensiveOperationSlowDown,
  sanitizeRequest,
  validatePagination
};