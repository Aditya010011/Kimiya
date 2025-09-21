const jwt = require('jsonwebtoken');
const databaseService = require('../services/database');



/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and adds user information to request object
 */
const authenticateToken = async (req, res, next) => {
  try {

    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {

      return res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure user still exists and is active
    const userResult = await databaseService.query(`
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM tblUsers
      WHERE id = @userId AND is_active = 1
    `, {
      userId: decoded.userId
    });

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'User not found or account deactivated'
      });
    }

    // Add user information to request object
    req.user = userResult.recordset[0];
    req.token = decoded.sessionToken || token; // Use session token if available, fallback to JWT token



    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Role-based authorization middleware
 * Requires user to have specific role(s)
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Admin-only middleware
 * Shortcut for requiring admin role
 */
const requireAdmin = requireRole('admin');

/**
 * Optional authentication middleware
 * Adds user info if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without user info
      req.user = null;
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userResult = await databaseService.query(`
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM tblUsers
      WHERE id = @userId AND is_active = 1
    `, {
      userId: decoded.userId
    });

    if (userResult.recordset && userResult.recordset.length > 0) {
      req.user = userResult.recordset[0];
      req.token = token;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If token is invalid, continue without user info
    req.user = null;
    next();
  }
};

/**
 * Rate limiting middleware (basic implementation)
 * Limits requests per user per time window
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const identifier = req.user ? req.user.id : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(identifier)) {
      const userRequests = requests.get(identifier).filter(time => time > windowStart);
      requests.set(identifier, userRequests);
    }

    // Get current request count
    const currentRequests = requests.get(identifier) || [];
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`,
        retryAfter: Math.ceil((currentRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    currentRequests.push(now);
    requests.set(identifier, currentRequests);

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  optionalAuth,
  rateLimit
};
