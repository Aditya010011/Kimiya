const jwt = require('jsonwebtoken');

/**
 * Session Middleware Factory
 * 
 * Creates authentication and session middleware without circular dependencies.
 * Uses dependency injection to provide services to middleware functions.
 * 
 * Key Features:
 * - Eliminates circular dependencies
 * - Dependency injection pattern
 * - Configurable middleware options
 * - Event-driven session management
 * - Comprehensive error handling
 * - Performance optimizations
 */
class SessionMiddlewareFactory {
  constructor(serviceRegistry) {
    this.serviceRegistry = serviceRegistry;
    this.middlewareCache = new Map();
    

  }

  /**
   * Create JWT authentication middleware
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware function
   */
  createAuthenticateToken(options = {}) {
    const config = {
      enableSessionTracking: options.enableSessionTracking !== false,
      enableHeartbeat: options.enableHeartbeat !== false,
      requireActiveSession: options.requireActiveSession !== false,
      ...options
    };

    return async (req, res, next) => {
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
        
        // Get database service
        const databaseService = await this.serviceRegistry.get('database');
        
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

        const user = userResult.recordset[0];

        // Add user information to request object
        req.user = user;
        req.token = token;

        // Handle session tracking if enabled
        if (config.enableSessionTracking) {
          try {
            const sessionService = await this.serviceRegistry.get('sessionService');
            
            if (config.requireActiveSession) {
              // Verify session exists and is active
              const sessionData = await sessionService.getSession(token);
              if (!sessionData) {
                return res.status(401).json({
                  success: false,
                  error: 'Invalid session',
                  message: 'Session has expired or is invalid'
                });
              }
              req.session = sessionData;
            }

            // Record heartbeat if enabled (async, don't wait)
            if (config.enableHeartbeat) {
              sessionService.recordHeartbeat(token, user.id).catch(err => {
                console.warn('Failed to record session heartbeat:', err.message);
              });
            }
          } catch (sessionError) {
            console.warn('Session tracking error:', sessionError.message);
            // Continue without session tracking if service is unavailable
          }
        }

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
          error: 'Authentication failed',
          message: 'An error occurred during authentication'
        });
      }
    };
  }

  /**
   * Create role-based authorization middleware
   * @param {string|Array} roles - Required role(s)
   * @returns {Function} Express middleware function
   */
  createRequireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please authenticate first'
        });
      }

      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        });
      }

      next();
    };
  }

  /**
   * Create admin-only middleware
   * @returns {Function} Express middleware function
   */
  createRequireAdmin() {
    return this.createRequireRole('admin');
  }

  /**
   * Create optional authentication middleware
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware function
   */
  createOptionalAuth(options = {}) {
    const config = {
      enableSessionTracking: options.enableSessionTracking !== false,
      ...options
    };

    return async (req, res, next) => {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          // No token provided, continue without user info
          req.user = null;
          req.session = null;
          return next();
        }

        // Try to verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get database service
        const databaseService = await this.serviceRegistry.get('database');
        
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

          // Handle session tracking if enabled
          if (config.enableSessionTracking) {
            try {
              const sessionService = await this.serviceRegistry.get('sessionService');
              const sessionData = await sessionService.getSession(token);
              req.session = sessionData;
            } catch (sessionError) {
              console.warn('Optional auth session tracking error:', sessionError.message);
              req.session = null;
            }
          }
        } else {
          req.user = null;
          req.session = null;
        }

        next();
      } catch (error) {
        // If token is invalid, continue without user info
        req.user = null;
        req.session = null;
        next();
      }
    };
  }

  /**
   * Create rate limiting middleware
   * @param {number} maxRequests - Maximum requests per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Function} Express middleware function
   */
  createRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const requests = new Map();

    return (req, res, next) => {
      const identifier = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get existing requests for this identifier
      let currentRequests = requests.get(identifier) || [];
      
      // Filter out requests outside the current window
      currentRequests = currentRequests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (currentRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
          retryAfter: Math.ceil((currentRequests[0] + windowMs - now) / 1000)
        });
      }

      // Add current request
      currentRequests.push(now);
      requests.set(identifier, currentRequests);

      next();
    };
  }

  /**
   * Create session validation middleware
   * @param {Object} options - Validation options
   * @returns {Function} Express middleware function
   */
  createValidateSession(options = {}) {
    const config = {
      requireHeartbeat: options.requireHeartbeat !== false,
      maxInactiveTime: options.maxInactiveTime || 5 * 60 * 1000, // 5 minutes
      ...options
    };

    return async (req, res, next) => {
      try {
        if (!req.token) {
          return res.status(401).json({
            success: false,
            error: 'No session token',
            message: 'Session token is required'
          });
        }

        const sessionService = await this.serviceRegistry.get('sessionService');
        const sessionData = await sessionService.getSession(req.token);

        if (!sessionData) {
          return res.status(401).json({
            success: false,
            error: 'Invalid session',
            message: 'Session has expired or is invalid'
          });
        }

        // Check heartbeat if required
        if (config.requireHeartbeat) {
          const timeSinceHeartbeat = Date.now() - sessionData.lastHeartbeat.getTime();
          if (timeSinceHeartbeat > config.maxInactiveTime) {
            // Expire the session
            await sessionService.expireSession(req.token, 'heartbeat_timeout');
            
            return res.status(401).json({
              success: false,
              error: 'Session inactive',
              message: 'Session expired due to inactivity'
            });
          }
        }

        req.session = sessionData;
        next();
      } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Session validation failed',
          message: 'An error occurred during session validation'
        });
      }
    };
  }

  /**
   * Create session cleanup middleware (for logout endpoints)
   * @param {Object} options - Cleanup options
   * @returns {Function} Express middleware function
   */
  createSessionCleanup(options = {}) {
    const config = {
      expireAllUserSessions: options.expireAllUserSessions || false,
      reason: options.reason || 'manual_logout',
      ...options
    };

    return async (req, res, next) => {
      try {
        const sessionService = await this.serviceRegistry.get('sessionService');

        if (config.expireAllUserSessions && req.user) {
          // Expire all sessions for the user
          const expiredCount = await sessionService.expireUserSessions(req.user.id, config.reason);
          req.expiredSessionCount = expiredCount;
        } else if (req.token) {
          // Expire only the current session
          const success = await sessionService.expireSession(req.token, config.reason);
          req.sessionExpired = success;
        }

        next();
      } catch (error) {
        console.error('Session cleanup error:', error);
        // Continue even if cleanup fails
        next();
      }
    };
  }

  /**
   * Get cached middleware or create new one
   * @param {string} type - Middleware type
   * @param {string} key - Cache key
   * @param {Function} factory - Factory function
   * @returns {Function} Middleware function
   */
  getCachedMiddleware(type, key, factory) {
    const cacheKey = `${type}:${key}`;
    
    if (this.middlewareCache.has(cacheKey)) {
      return this.middlewareCache.get(cacheKey);
    }

    const middleware = factory();
    this.middlewareCache.set(cacheKey, middleware);
    return middleware;
  }

  /**
   * Clear middleware cache
   */
  clearCache() {
    this.middlewareCache.clear();

  }
}

module.exports = SessionMiddlewareFactory;
