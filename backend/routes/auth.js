const express = require('express');
const databaseService = require('../services/database');

// Import service registry to get session services
const { serviceRegistry } = require('../core/SessionServiceBootstrap');
const {
  passwordUtils,
  tokenUtils,
  validationRules,
  handleValidationErrors,
  sanitizeUser
} = require('../utils/auth-utils');

const router = express.Router();

// Middleware functions (will be set after session services are initialized)
let authenticateToken = null;
let requireAdmin = null;
let rateLimit = null;

// Helper function to get session services
async function getSessionServices() {
  try {
    if (!serviceRegistry.isInitialized('sessionService')) {
      // Fallback to basic auth if session services aren't ready
      return null;
    }

    return {
      sessionService: await serviceRegistry.get('sessionService'),
      middlewareFactory: await serviceRegistry.get('sessionMiddlewareFactory')
    };
  } catch (error) {
    console.warn('Session services not available:', error.message);
    return null;
  }
}

// Initialize middleware with fallback
const basicAuth = require('../middleware/auth');
authenticateToken = basicAuth.authenticateToken;
requireAdmin = basicAuth.requireAdmin;
rateLimit = basicAuth.rateLimit;

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', 
  rateLimit(5, 15 * 60 * 1000), // 5 registrations per 15 minutes
  validationRules.register,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, first_name, last_name, role = 'user' } = req.body;

      // Check if user already exists
      const existingUserResult = await databaseService.query(`
        SELECT id FROM tblUsers WHERE email = @email
      `, { email });

      if (existingUserResult.recordset.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          message: 'An account with this email address already exists'
        });
      }

      // Hash password
      const passwordHash = await passwordUtils.hashPassword(password);

      // Create user
      await databaseService.query(`
        INSERT INTO tblUsers (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
        VALUES (@email, @passwordHash, @firstName, @lastName, @role, 1, GETDATE(), GETDATE())
      `, {
        email,
        passwordHash,
        firstName: first_name || null,
        lastName: last_name || null,
        role
      });

      // Get the created user
      const createUserResult = await databaseService.query(`
        SELECT * FROM tblUsers WHERE email = @email
      `, { email });

      const newUser = createUserResult.recordset[0];

      // Generate tokens
      const accessToken = tokenUtils.generateAccessToken(newUser);
      const refreshToken = tokenUtils.generateRefreshToken(newUser);

      // Log successful registration
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `New user registered: ${email}`
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: sanitizeUser(newUser),
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: process.env.JWT_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific database errors
      if (error.message.includes('UNIQUE KEY constraint')) {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
          message: 'An account with this email address already exists'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        message: 'An error occurred during user registration'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login',
  rateLimit(10, 15 * 60 * 1000), // 10 login attempts per 15 minutes
  validationRules.login,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const userResult = await databaseService.query(`
        SELECT * FROM tblUsers WHERE email = @email AND is_active = 1
      `, { email });

      if (userResult.recordset.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      const user = userResult.recordset[0];

      // Verify password
      const isPasswordValid = await passwordUtils.comparePassword(password, user.password_hash);

      if (!isPasswordValid) {
        // Log failed login attempt
        await databaseService.query(`
          INSERT INTO tblLogs (message, level, source, created_at)
          VALUES (@message, 'WARN', 'AUTH', GETDATE())
        `, {
          message: `Failed login attempt for email: ${email}`
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Create user session record first
      const sessionToken = require('crypto').randomBytes(32).toString('hex');

      // Generate tokens with session token included
      const accessToken = tokenUtils.generateAccessToken(user, sessionToken);
      const refreshToken = tokenUtils.generateRefreshToken(user);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

      // Get client info
      const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Create session using session service
      try {
        const services = await getSessionServices();
        if (services) {
          await services.sessionService.createSession({
            userId: user.id,
            sessionToken: sessionToken,
            expiresAt: expiresAt,
            ipAddress: ipAddress,
            userAgent: userAgent,
            deviceInfo: {
              userAgent: userAgent,
              ipAddress: ipAddress,
              loginTime: new Date()
            }
          });
        } else {
          throw new Error('Session service not available');
        }
      } catch (sessionError) {
        console.error('Failed to create session:', sessionError.message);
        return res.status(500).json({
          success: false,
          error: 'Session creation failed',
          message: 'Unable to create user session'
        });
      }

      // Log successful login
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `User logged in: ${email} (Session: ${sessionToken.substring(0, 8)}...)`
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: sanitizeUser(user),
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: process.env.JWT_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (token invalidation would require token blacklist)
 */
router.post('/logout',
  authenticateToken,
  async (req, res) => {
    try {
      // Use session service to expire all user sessions
      let expiredCount = 0;
      try {
        const services = await getSessionServices();
        if (services) {
          expiredCount = await services.sessionService.expireUserSessions(req.user.id, 'manual_logout');
        }
      } catch (sessionError) {
        console.warn('Failed to expire sessions with session service:', sessionError.message);
        // Continue without session service
      }



      // Log logout
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `User logged out: ${req.user.email}`
      });

      res.json({
        success: true,
        message: 'Logout successful',
        data: {
          message: 'Please remove the token from your client storage'
        }
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'An error occurred during logout'
      });
    }
  }
);

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile',
  authenticateToken,
  async (req, res) => {
    try {
      // User information is already available from authenticateToken middleware
      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: sanitizeUser(req.user)
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Profile retrieval failed',
        message: 'An error occurred while retrieving profile'
      });
    }
  }
);

/**
 * PUT /api/auth/profile
 * Update current user profile
 */
router.put('/profile',
  authenticateToken,
  validationRules.updateProfile,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { first_name, last_name, email } = req.body;
      const userId = req.user.id;

      // If email is being updated, check if it's already taken by another user
      if (email && email !== req.user.email) {
        const existingUserResult = await databaseService.query(`
          SELECT id FROM tblUsers WHERE email = @email AND id != @userId
        `, { email, userId });

        if (existingUserResult.recordset.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Email already taken',
            message: 'This email address is already associated with another account'
          });
        }
      }

      // Build update query dynamically based on provided fields
      const updateFields = [];
      const updateParams = { userId };

      if (first_name !== undefined) {
        updateFields.push('first_name = @firstName');
        updateParams.firstName = first_name;
      }

      if (last_name !== undefined) {
        updateFields.push('last_name = @lastName');
        updateParams.lastName = last_name;
      }

      if (email && email !== req.user.email) {
        updateFields.push('email = @email');
        updateParams.email = email;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No updates provided',
          message: 'Please provide at least one field to update'
        });
      }

      // Add updated_at field
      updateFields.push('updated_at = GETDATE()');

      // Execute update
      const updateQuery = `
        UPDATE tblUsers
        SET ${updateFields.join(', ')}
        WHERE id = @userId AND is_active = 1
      `;

      await databaseService.query(updateQuery, updateParams);

      // Get the updated user
      const updateResult = await databaseService.query(`
        SELECT * FROM tblUsers WHERE id = @userId AND is_active = 1
      `, { userId });

      if (updateResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User account not found or inactive'
        });
      }

      const updatedUser = updateResult.recordset[0];

      // Log profile update
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `Profile updated for user: ${updatedUser.email}`
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: sanitizeUser(updatedUser)
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);

      // Handle specific database errors
      if (error.message.includes('UNIQUE KEY constraint')) {
        return res.status(409).json({
          success: false,
          error: 'Email already taken',
          message: 'This email address is already associated with another account'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Profile update failed',
        message: 'An error occurred while updating profile'
      });
    }
  }
);

/**
 * PUT /api/auth/change-password
 * Change user password
 */
router.put('/change-password',
  authenticateToken,
  validationRules.changePassword,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get current user with password hash
      const userResult = await databaseService.query(`
        SELECT password_hash FROM tblUsers WHERE id = @userId AND is_active = 1
      `, { userId });

      if (userResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User account not found or inactive'
        });
      }

      const user = userResult.recordset[0];

      // Verify current password
      const isCurrentPasswordValid = await passwordUtils.comparePassword(currentPassword, user.password_hash);

      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid current password',
          message: 'The current password you provided is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await passwordUtils.hashPassword(newPassword);

      // Update password
      await databaseService.query(`
        UPDATE tblUsers
        SET password_hash = @newPasswordHash, updated_at = GETDATE()
        WHERE id = @userId
      `, {
        newPasswordHash,
        userId
      });

      // Log password change
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `Password changed for user: ${req.user.email}`
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          message: 'Your password has been updated. Please use the new password for future logins.'
        }
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Password change failed',
        message: 'An error occurred while changing password'
      });
    }
  }
);

/**
 * GET /api/auth/admin/users
 * Get all users with activity metrics (admin only)
 */
router.get('/admin/users',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      // Get all users with enhanced activity metrics
      const usersResult = await databaseService.query(`
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          -- Count of workflow templates created by user
          ISNULL((SELECT COUNT(*) FROM tblWorkflowTemplates wt WHERE wt.created_by = u.id), 0) as workflow_count,
          -- Count of active sessions (not expired and still active)
          ISNULL((SELECT COUNT(*) FROM tblUserSessions us
                  WHERE us.user_id = u.id
                  AND us.is_active = 1
                  AND us.expires_at > GETDATE()), 0) as active_sessions,
          -- Last login (most recent session creation)
          (SELECT TOP 1 us.created_at
           FROM tblUserSessions us
           WHERE us.user_id = u.id
           ORDER BY us.created_at DESC) as last_login,
          -- Last activity (most recent session access)
          (SELECT TOP 1 us.last_accessed_at
           FROM tblUserSessions us
           WHERE us.user_id = u.id
           ORDER BY us.last_accessed_at DESC) as last_activity,
          -- Total login count (total sessions created)
          ISNULL((SELECT COUNT(*) FROM tblUserSessions us WHERE us.user_id = u.id), 0) as total_logins
        FROM tblUsers u
        ORDER BY u.created_at DESC
      `);

      // Get call activity for each user (if call logs exist)
      // Note: tblCallLogs doesn't have user_id yet, so we'll return empty stats for now
      const callStatsResult = { recordset: [] };

      // Create a map of call stats by user ID
      const callStatsMap = {};
      if (callStatsResult.recordset) {
        callStatsResult.recordset.forEach(stat => {
          callStatsMap[stat.user_id] = {
            total_calls: stat.total_calls || 0,
            successful_calls: stat.successful_calls || 0,
            total_call_duration: stat.total_call_duration || 0
          };
        });
      }

      // Combine user data with call stats
      const usersWithStats = usersResult.recordset.map(user => ({
        ...sanitizeUser(user),
        activity_metrics: {
          workflow_count: user.workflow_count || 0,
          active_sessions: user.active_sessions || 0,
          last_login: user.last_login,
          last_activity: user.last_activity,
          total_logins: user.total_logins || 0,
          call_stats: callStatsMap[user.id] || {
            total_calls: 0,
            successful_calls: 0,
            total_call_duration: 0
          }
        }
      }));

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: usersWithStats,
          total_count: usersWithStats.length,
          active_count: usersWithStats.filter(u => u.is_active).length,
          admin_count: usersWithStats.filter(u => u.role === 'admin').length
        }
      });

    } catch (error) {
      console.error('Admin users fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
        message: 'An error occurred while retrieving user data'
      });
    }
  }
);

/**
 * GET /api/auth/admin/users/:id
 * Get detailed user information (admin only)
 */
router.get('/admin/users/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          message: 'Please provide a valid user ID'
        });
      }

      // Get user details
      const userResult = await databaseService.query(`
        SELECT
          id, email, first_name, last_name, role, is_active, created_at, updated_at
        FROM tblUsers
        WHERE id = @userId
      `, { userId });

      if (!userResult.recordset || userResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'No user found with the specified ID'
        });
      }

      const user = userResult.recordset[0];

      // Get user sessions
      const sessionsResult = await databaseService.query(`
        SELECT
          id, session_token, expires_at, created_at, last_accessed_at,
          ip_address, user_agent, is_active
        FROM tblUserSessions
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `, { userId });

      // Get user workflows
      const workflowsResult = await databaseService.query(`
        SELECT
          id, name, description, category, is_active, created_at, updated_at
        FROM tblWorkflowTemplates
        WHERE created_by = @userId
        ORDER BY created_at DESC
      `, { userId });

      // Get user call logs (if exists)
      // Note: tblCallLogs doesn't have user_id yet, so we'll return empty logs for now
      const callLogsResult = { recordset: [] };

      res.json({
        success: true,
        message: 'User details retrieved successfully',
        data: {
          user: sanitizeUser(user),
          sessions: sessionsResult.recordset || [],
          workflows: workflowsResult.recordset || [],
          call_logs: callLogsResult.recordset || []
        }
      });

    } catch (error) {
      console.error('Admin user detail fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user details',
        message: 'An error occurred while retrieving user details'
      });
    }
  }
);

/**
 * PUT /api/auth/admin/users/:id/status
 * Update user active status (admin only)
 */
router.put('/admin/users/:id/status',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { is_active } = req.body;

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          message: 'Please provide a valid user ID'
        });
      }

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: 'Status must be true or false'
        });
      }

      // Prevent admin from deactivating themselves
      if (req.user.id === userId && !is_active) {
        return res.status(400).json({
          success: false,
          error: 'Cannot deactivate own account',
          message: 'You cannot deactivate your own account'
        });
      }

      // Update user status
      const updateResult = await databaseService.query(`
        UPDATE tblUsers
        SET is_active = @isActive, updated_at = GETDATE()
        WHERE id = @userId
      `, {
        userId,
        isActive: is_active
      });

      if (updateResult.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'No user found with the specified ID'
        });
      }

      // Get the updated user data
      const userResult = await databaseService.query(`
        SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
        FROM tblUsers
        WHERE id = @userId
      `, { userId });

      const updatedUser = userResult.recordset[0];

      // Log the action
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'ADMIN', GETDATE())
      `, {
        message: `Admin ${req.user.email} ${is_active ? 'activated' : 'deactivated'} user ${updatedUser.email}`
      });

      res.json({
        success: true,
        message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
        data: {
          user: sanitizeUser(updatedUser)
        }
      });

    } catch (error) {
      console.error('Admin user status update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user status',
        message: 'An error occurred while updating user status'
      });
    }
  }
);

/**
 * POST /api/auth/heartbeat
 * Record session heartbeat to keep user online
 */
router.post('/heartbeat',
  authenticateToken,
  async (req, res) => {
    try {
      const sessionToken = req.token;
      const userId = req.user.id;

      // Record heartbeat in session service
      let success = false;
      try {
        const services = await getSessionServices();
        if (services) {
          success = await services.sessionService.recordHeartbeat(sessionToken, userId);
        } else {
          // Session service not available, but token is valid (verified by middleware)
          success = true;
        }
      } catch (sessionError) {
        console.warn('Failed to record heartbeat with session service:', sessionError.message);
        // Continue - token is still valid even if heartbeat fails
        success = true;
      }

      if (success) {
        res.json({
          success: true,
          message: 'Heartbeat recorded',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to record heartbeat'
        });
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record heartbeat',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/auth/logout-tab
 * Mark user offline when closing browser tab
 */
router.post('/logout-tab',
  authenticateToken,
  async (req, res) => {
    try {
      const sessionToken = req.token;

      // Expire the specific session
      try {
        const services = await getSessionServices();
        if (services) {
          await services.sessionService.expireSession(sessionToken, 'tab_closed');
        }
      } catch (sessionError) {
        console.warn('Failed to expire session with session service:', sessionError.message);
        // Continue without session service
      }

      res.json({
        success: true,
        message: 'Session marked offline'
      });
    } catch (error) {
      console.error('Tab logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark session offline',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/auth/admin/users/:id
 * Permanently delete a user (admin only)
 */
router.delete('/admin/users/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {

      const userId = parseInt(req.params.id);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          message: 'Please provide a valid user ID'
        });
      }

      // Prevent admin from deleting themselves
      if (req.user.id === userId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete own account',
          message: 'You cannot delete your own account'
        });
      }

      // Get user details before deletion for logging
      const userResult = await databaseService.query(`
        SELECT id, email, first_name, last_name, role, is_active
        FROM tblUsers
        WHERE id = @userId
      `, { userId });

      if (!userResult.recordset || userResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'No user found with the specified ID'
        });
      }

      const userToDelete = userResult.recordset[0];

      // Start transaction for cascading deletes
      const transaction = await databaseService.beginTransaction();

      try {
        // Delete related data in correct order to avoid foreign key constraints

        // 1. Delete user sessions
        await transaction.request().query(`
          DELETE FROM tblUserSessions WHERE user_id = ${userId}
        `);

        // 2. Delete workflow-related data (cascading deletes will handle child tables)
        // First delete from tblWorkflows (this will cascade to tblWorkflowConfigs, tblFlowNodes, tblFlowEdges)
        await transaction.request().query(`
          DELETE FROM tblWorkflows WHERE created_by = ${userId}
        `);

        // 3. Delete workflow templates created by user
        await transaction.request().query(`
          DELETE FROM tblWorkflowTemplates WHERE created_by = ${userId}
        `);

        // 4. Delete any call logs associated with user (if user_id column exists)
        // Note: Currently tblCallLogs doesn't have user_id, but we'll add this for future compatibility
        try {
          await transaction.request().query(`
            DELETE FROM tblCallLogs WHERE user_id = ${userId}
          `);
        } catch (error) {
          // Ignore error if user_id column doesn't exist yet
        }

        // 5. Finally delete the user
        const deleteResult = await transaction.request().query(`
          DELETE FROM tblUsers WHERE id = ${userId}
        `);

        if (deleteResult.rowsAffected[0] === 0) {
          await databaseService.rollbackTransaction(transaction);
          return res.status(404).json({
            success: false,
            error: 'User not found',
            message: 'No user found with the specified ID'
          });
        }

        // Commit the transaction
        await databaseService.commitTransaction(transaction);

        // Log the deletion action
        await databaseService.query(`
          INSERT INTO tblLogs (message, level, source, created_at)
          VALUES (@message, 'WARN', 'ADMIN', GETDATE())
        `, {
          message: `Admin ${req.user.email} permanently deleted user ${userToDelete.email} (ID: ${userId})`
        });

        res.json({
          success: true,
          message: 'User deleted permanently',
          data: {
            deleted_user: {
              id: userToDelete.id,
              email: userToDelete.email,
              role: userToDelete.role
            }
          }
        });

      } catch (transactionError) {
        await databaseService.rollbackTransaction(transaction);
        throw transactionError;
      }

    } catch (error) {
      console.error('Admin user deletion error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        message: 'An error occurred while deleting the user'
      });
    }
  }
);

/**
 * GET /api/auth/session-stats
 * Get session statistics (admin only)
 */
router.get('/session-stats',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      let stats = { totalInMemory: 0, active: 0, expired: 0, lastCleanup: null };
      try {
        const services = await getSessionServices();
        if (services) {
          const sessionStats = await services.sessionService.getSessionStats();
          stats = sessionStats.cache || stats;
        }
      } catch (sessionError) {
        console.warn('Failed to get session stats from session service:', sessionError.message);
        // Continue with default stats
      }

      // Get additional database stats
      const dbStats = await databaseService.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
          COUNT(CASE WHEN is_active = 1 AND expires_at > GETDATE() THEN 1 END) as valid_sessions
        FROM tblUserSessions
      `);

      res.json({
        success: true,
        data: {
          memory: stats,
          database: dbStats.recordset[0]
        }
      });
    } catch (error) {
      console.error('Session stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session statistics',
        message: error.message
      });
    }
  }
);

module.exports = router;
