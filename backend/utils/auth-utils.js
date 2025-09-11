const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

/**
 * Password hashing utilities
 */
const passwordUtils = {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password) {
    const saltRounds = 12; // Higher salt rounds for better security
    return await bcrypt.hash(password, saltRounds);
  },

  /**
   * Compare a plain password with a hashed password
   */
  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

/**
 * JWT token utilities
 */
const tokenUtils = {
  /**
   * Generate JWT access token
   */
  generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'kimiya-voice-api',
      audience: 'kimiya-voice-client'
    });
  },

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'kimiya-voice-api',
      audience: 'kimiya-voice-client'
    });
  },

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'kimiya-voice-api',
      audience: 'kimiya-voice-client'
    });
  },

  /**
   * Decode JWT token without verification (for debugging)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
};

/**
 * Input validation rules
 */
const validationRules = {
  /**
   * User registration validation
   */
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .custom((password) => {
        const validation = passwordUtils.validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('. '));
        }
        return true;
      }),
    
    body('first_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be between 1 and 100 characters'),
    
    body('last_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be between 1 and 100 characters'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either "user" or "admin"')
  ],

  /**
   * User login validation
   */
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  /**
   * Profile update validation
   */
  updateProfile: [
    body('first_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be between 1 and 100 characters'),
    
    body('last_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be between 1 and 100 characters'),
    
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ],

  /**
   * Password change validation
   */
  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .custom((password) => {
        const validation = passwordUtils.validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('. '));
        }
        return true;
      })
  ]
};

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Please check your input data',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * Sanitize user data for API responses
 */
const sanitizeUser = (user) => {
  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

module.exports = {
  passwordUtils,
  tokenUtils,
  validationRules,
  handleValidationErrors,
  sanitizeUser
};
