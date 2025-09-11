const express = require('express');
const databaseService = require('../services/database');
const { authenticateToken, requireAdmin, rateLimit } = require('../middleware/auth');
const { 
  passwordUtils, 
  tokenUtils, 
  validationRules, 
  handleValidationErrors, 
  sanitizeUser 
} = require('../utils/auth-utils');

const router = express.Router();

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
      const createUserResult = await databaseService.query(`
        INSERT INTO tblUsers (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES (@email, @passwordHash, @firstName, @lastName, @role, 1, GETDATE(), GETDATE())
      `, {
        email,
        passwordHash,
        firstName: first_name || null,
        lastName: last_name || null,
        role
      });

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

      // Generate tokens
      const accessToken = tokenUtils.generateAccessToken(user);
      const refreshToken = tokenUtils.generateRefreshToken(user);

      // Log successful login
      await databaseService.query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, 'INFO', 'AUTH', GETDATE())
      `, {
        message: `User logged in: ${email}`
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
        OUTPUT INSERTED.*
        WHERE id = @userId AND is_active = 1
      `;

      const updateResult = await databaseService.query(updateQuery, updateParams);

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

module.exports = router;
