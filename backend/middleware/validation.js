const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Custom validators
const isObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

const isEmail = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error('Invalid email format');
  }
  return true;
};

const isStrongPassword = (value) => {
  if (value.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  if (!/(?=.*[a-z])/.test(value)) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!/(?=.*[A-Z])/.test(value)) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!/(?=.*\d)/.test(value)) {
    throw new Error('Password must contain at least one number');
  }
  return true;
};

const sanitizeInput = (value) => {
  if (typeof value === 'string') {
    // Remove potentially dangerous characters
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\\$'"]/g, '')
      .trim();
  }
  return value;
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  // Sanitize all string fields in body, params, and query
  ['body', 'params', 'query'].forEach(key => {
    if (req[key]) {
      Object.keys(req[key]).forEach(field => {
        if (typeof req[key][field] === 'string') {
          req[key][field] = sanitizeInput(req[key][field]);
        } else if (Array.isArray(req[key][field])) {
          req[key][field] = req[key][field].map(item => 
            typeof item === 'string' ? sanitizeInput(item) : item
          );
        }
      });
    }
  });
  
  next();
};

// Auth validation rules
const registerValidation = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .notEmpty().withMessage('Email is required')
    .custom(isEmail).withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 100 }).withMessage('Email must be less than 100 characters'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/(?=.*[a-z])/).withMessage('Password must contain at least one lowercase letter')
    .matches(/(?=.*[A-Z])/).withMessage('Password must contain at least one uppercase letter')
    .matches(/(?=.*\d)/).withMessage('Password must contain at least one number'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
];

const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .custom(isEmail).withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Email validation
const emailValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
];

// Password reset validation
const passwordResetValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid token format'),
  
  body('password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/(?=.*[a-z])/).withMessage('Password must contain at least one lowercase letter')
    .matches(/(?=.*[A-Z])/).withMessage('Password must contain at least one uppercase letter')
    .matches(/(?=.*\d)/).withMessage('Password must contain at least one number'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/(?=.*[a-z])/).withMessage('New password must contain at least one lowercase letter')
    .matches(/(?=.*[A-Z])/).withMessage('New password must contain at least one uppercase letter')
    .matches(/(?=.*\d)/).withMessage('New password must contain at least one number'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
];

// Update profile validation
const updateProfileValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
];

// Email verification validation
const emailVerificationValidation = [
  body('token')
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid token format')
];
const validateExpirationDate = (value) => {
  if (!value) return true; // Optional field
  
  const expiryDate = new Date(value);
  const now = new Date();
  
  if (expiryDate <= now) {
    throw new Error('Expiration date must be in the future');
  }
  
  // Limit to maximum 1 year in the future
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (expiryDate > oneYearFromNow) {
    throw new Error('Expiration date cannot be more than 1 year in the future');
  }
  
  return true;
};

// Enhanced create poll validation with expiration
const createPollValidation = [
  body('question')
    .notEmpty().withMessage('Poll question is required')
    .isLength({ min: 10, max: 500 }).withMessage('Question must be between 10 and 500 characters')
    .matches(/^[a-zA-Z0-9\s\.,!?()'"-]+$/).withMessage('Question contains invalid characters'),
  
  body('options')
    .isArray({ min: 2, max: 10 }).withMessage('Poll must have between 2 and 10 options')
    .custom((options) => {
      if (options.some(opt => typeof opt !== 'string')) {
        throw new Error('All options must be strings');
      }
      if (options.some(opt => opt.trim().length === 0)) {
        throw new Error('Options cannot be empty');
      }
      if (options.some(opt => opt.length > 200)) {
        throw new Error('Options must be less than 200 characters');
      }
      
      const lowerCaseOptions = options.map(opt => opt.toLowerCase().trim());
      const uniqueOptions = new Set(lowerCaseOptions);
      if (uniqueOptions.size !== options.length) {
        throw new Error('Poll options must be unique');
      }
      
      return true;
    }),
  
  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean'),
  
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('Expiration date must be a valid date')
    .custom(validateExpirationDate),
  
  body('allowVotingAfterExpiry')
    .optional()
    .isBoolean().withMessage('allowVotingAfterExpiry must be a boolean'),
  
  body('showResultsAfterExpiry')
    .optional()
    .isBoolean().withMessage('showResultsAfterExpiry must be a boolean'),
  
  body('autoArchive')
    .optional()
    .isBoolean().withMessage('autoArchive must be a boolean')
];

// Enhanced update poll validation
const updatePollValidation = [
  param('id')
    .notEmpty().withMessage('Poll ID is required')
    .custom(isObjectId).withMessage('Invalid poll ID format'),
  
  body('question')
    .optional()
    .isLength({ min: 10, max: 500 }).withMessage('Question must be between 10 and 500 characters')
    .matches(/^[a-zA-Z0-9\s\.,!?()'"-]+$/).withMessage('Question contains invalid characters'),
  
  body('isPublished')
    .optional()
    .isBoolean().withMessage('isPublished must be a boolean'),
  
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('Expiration date must be a valid date')
    .custom(validateExpirationDate),
  
  body('allowVotingAfterExpiry')
    .optional()
    .isBoolean().withMessage('allowVotingAfterExpiry must be a boolean'),
  
  body('showResultsAfterExpiry')
    .optional()
    .isBoolean().withMessage('showResultsAfterExpiry must be a boolean'),
  
  body('autoArchive')
    .optional()
    .isBoolean().withMessage('autoArchive must be a boolean'),
  
  body('options')
    .optional()
    .isArray({ min: 2, max: 10 }).withMessage('Poll must have between 2 and 10 options')
    .custom((options) => {
      if (options.some(opt => typeof opt !== 'string')) {
        throw new Error('All options must be strings');
      }
      if (options.some(opt => opt.trim().length === 0)) {
        throw new Error('Options cannot be empty');
      }
      if (options.some(opt => opt.length > 200)) {
        throw new Error('Options must be less than 200 characters');
      }
      
      const lowerCaseOptions = options.map(opt => opt.toLowerCase().trim());
      const uniqueOptions = new Set(lowerCaseOptions);
      if (uniqueOptions.size !== options.length) {
        throw new Error('Poll options must be unique');
      }
      
      return true;
    })
];
// Vote validation
const voteValidation = [
  body('poll')
    .notEmpty().withMessage('Poll ID is required')
    .custom(isObjectId).withMessage('Invalid poll ID format'),
  
  body('pollOption')
    .notEmpty().withMessage('Poll option ID is required')
    .custom(isObjectId).withMessage('Invalid poll option ID format')
];

const pollIdValidation = [
  param('id')
    .notEmpty().withMessage('Poll ID is required')
    .custom(isObjectId).withMessage('Invalid poll ID format')
];

const optionIdValidation = [
  param('id')
    .notEmpty().withMessage('Option ID is required')
    .custom(isObjectId).withMessage('Invalid option ID format')
];

const userIdValidation = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .custom(isObjectId).withMessage('Invalid user ID format')
];

// Enhanced poll query validation
const pollQueryValidation = [
  query('published')
    .optional()
    .isIn(['true', 'false']).withMessage('Published must be true or false'),
  
  query('includeUnpublished')
    .optional()
    .isIn(['true', 'false']).withMessage('includeUnpublished must be true or false'),
  
  query('myPolls')
    .optional()
    .isIn(['true', 'false']).withMessage('myPolls must be true or false'),
  
  query('status')
    .optional()
    .isIn(['active', 'expired', 'draft', 'all']).withMessage('Status must be active, expired, draft, or all'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

// User query validation
const userQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 50 }).withMessage('Search term must be between 2 and 50 characters')
    .matches(/^[a-zA-Z0-9\s@.-]+$/).withMessage('Search term contains invalid characters'),
  
  query('role')
    .optional()
    .isIn(['user', 'admin']).withMessage('Role must be either user or admin')
];

// Admin user update validation
const adminUserUpdateValidation = [
  param('id')
    .notEmpty().withMessage('User ID is required')
    .custom(isObjectId).withMessage('Invalid user ID format'),
  
  body('role')
    .optional()
    .isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
  
  body('isVerified')
    .optional()
    .isBoolean().withMessage('isVerified must be a boolean'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean')
];

// Search validation
const searchValidation = [
  query('q')
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\.,!?()'"-]+$/).withMessage('Search query contains invalid characters'),
  
  query('type')
    .optional()
    .isIn(['polls', 'users', 'all']).withMessage('Type must be polls, users, or all')
];

// Export all validation rules
module.exports = {
  // Core functions
  handleValidationErrors,
  sanitizeInput,

  // Custom validators
  isObjectId,
  isEmail,
  isStrongPassword,

  // Authentication validations
  registerValidation,
  loginValidation,
  emailValidation,
  passwordResetValidation,
  changePasswordValidation,
  updateProfileValidation,
  emailVerificationValidation,

  // Poll validations
  createPollValidation,
  updatePollValidation,
  voteValidation,
  pollIdValidation,
  optionIdValidation,
  pollQueryValidation,
  validateExpirationDate,

  // User validations
  userIdValidation,
  userQueryValidation,
  adminUserUpdateValidation,

  // Search validation
  searchValidation
};