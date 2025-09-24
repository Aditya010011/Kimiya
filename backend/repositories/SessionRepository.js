/**
 * Session Repository
 * 
 * Handles all database operations related to user sessions.
 * This layer abstracts database access and provides a clean interface
 * for session management operations.
 * 
 * Key Features:
 * - Database abstraction layer
 * - Transaction support
 * - Query optimization
 * - Error handling and logging
 * - Batch operations support
 */
class SessionRepository {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} Created session
   */
  async createSession(sessionData) {
    try {
      const {
        userId,
        sessionToken,
        expiresAt,
        ipAddress,
        userAgent,
        deviceInfo = null
      } = sessionData;

      await this.db.query(`
        INSERT INTO tblUserSessions (
          user_id, session_token, expires_at, created_at, last_accessed_at,
          ip_address, user_agent, device_info, is_active
        )
        VALUES (
          @userId, @sessionToken, @expiresAt, GETDATE(), GETDATE(),
          @ipAddress, @userAgent, @deviceInfo, 1
        )
      `, {
        userId,
        sessionToken,
        expiresAt,
        ipAddress,
        userAgent: userAgent?.substring(0, 500), // Limit length
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null
      });

      // Get the inserted record
      const result = await this.db.query(`
        SELECT * FROM tblUserSessions
        WHERE session_token = @sessionToken
      `, { sessionToken });

      return result.recordset[0];
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  /**
   * Get session by token
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object|null>} Session data or null
   */
  async getSessionByToken(sessionToken) {
    try {
      const result = await this.db.query(`
        SELECT 
          id, user_id, session_token, expires_at, created_at, last_accessed_at,
          ip_address, user_agent, device_info, is_active
        FROM tblUserSessions
        WHERE session_token = @sessionToken
      `, { sessionToken });

      return result.recordset[0] || null;
    } catch (error) {
      console.error('❌ Failed to get session by token:', error);
      throw new Error(`Session retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get active sessions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  async getActiveSessionsByUser(userId) {
    try {
      const result = await this.db.query(`
        SELECT 
          id, session_token, expires_at, created_at, last_accessed_at,
          ip_address, user_agent, device_info
        FROM tblUserSessions
        WHERE user_id = @userId 
          AND is_active = 1 
          AND expires_at > GETDATE()
        ORDER BY last_accessed_at DESC
      `, { userId });

      return result.recordset;
    } catch (error) {
      console.error('❌ Failed to get active sessions:', error);
      throw new Error(`Active sessions retrieval failed: ${error.message}`);
    }
  }

  /**
   * Update session last accessed time (heartbeat)
   * @param {string} sessionToken - Session token
   * @param {number} userId - User ID (for security)
   * @returns {Promise<boolean>} Success status
   */
  async updateLastAccessed(sessionToken, userId) {
    try {
      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET last_accessed_at = GETDATE(),
            is_active = 1,
            expiration_reason = NULL
        WHERE session_token = @sessionToken
          AND user_id = @userId
          AND expires_at > GETDATE()
      `, { sessionToken, userId });

      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('❌ Failed to update session last accessed:', error);
      throw new Error(`Session update failed: ${error.message}`);
    }
  }

  /**
   * Expire a specific session
   * @param {string} sessionToken - Session token
   * @param {string} reason - Expiration reason
   * @returns {Promise<boolean>} Success status
   */
  async expireSession(sessionToken, reason = 'manual') {
    try {
      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET is_active = 0, 
            last_accessed_at = GETDATE(),
            expiration_reason = @reason
        WHERE session_token = @sessionToken
      `, { sessionToken, reason });

      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('❌ Failed to expire session:', error);
      throw new Error(`Session expiration failed: ${error.message}`);
    }
  }

  /**
   * Expire all sessions for a user
   * @param {number} userId - User ID
   * @param {string} reason - Expiration reason
   * @returns {Promise<number>} Number of expired sessions
   */
  async expireUserSessions(userId, reason = 'logout_all') {
    try {
      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET is_active = 0, 
            last_accessed_at = GETDATE(),
            expiration_reason = @reason
        WHERE user_id = @userId AND is_active = 1
      `, { userId, reason });

      return result.rowsAffected[0] || 0;
    } catch (error) {
      console.error('❌ Failed to expire user sessions:', error);
      throw new Error(`User sessions expiration failed: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of cleaned sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET is_active = 0, 
            last_accessed_at = GETDATE(),
            expiration_reason = 'expired'
        WHERE is_active = 1 AND expires_at <= GETDATE()
      `);

      const cleanedCount = result.rowsAffected[0] || 0;
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup expired sessions:', error);
      throw new Error(`Session cleanup failed: ${error.message}`);
    }
  }

  /**
   * Clean up sessions that haven't sent heartbeats
   * @param {number} timeoutMs - Heartbeat timeout in milliseconds
   * @returns {Promise<number>} Number of expired sessions
   */
  async expireInactiveSessions(timeoutMs = 5 * 60 * 1000) {
    try {
      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET is_active = 0, 
            last_accessed_at = GETDATE(),
            expiration_reason = 'heartbeat_timeout'
        WHERE is_active = 1 
          AND last_accessed_at < DATEADD(millisecond, -@timeoutMs, GETDATE())
      `, { timeoutMs });

      const expiredCount = result.rowsAffected[0] || 0;
      if (expiredCount > 0) {
        console.log(`💓 Expired ${expiredCount} sessions due to missing heartbeats`);
      }

      return expiredCount;
    } catch (error) {
      console.error('❌ Failed to expire inactive sessions:', error);
      throw new Error(`Inactive session expiration failed: ${error.message}`);
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats() {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
          COUNT(CASE WHEN is_active = 1 AND expires_at > GETDATE() THEN 1 END) as valid_sessions,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as expired_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT CASE WHEN is_active = 1 THEN user_id END) as active_users
        FROM tblUserSessions
      `);

      return result.recordset[0];
    } catch (error) {
      console.error('❌ Failed to get session statistics:', error);
      throw new Error(`Session statistics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get user activity summary
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User activity data
   */
  async getUserActivity(userId) {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
          MAX(last_accessed_at) as last_activity,
          MIN(created_at) as first_session,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM tblUserSessions
        WHERE user_id = @userId
      `, { userId });

      return result.recordset[0];
    } catch (error) {
      console.error('❌ Failed to get user activity:', error);
      throw new Error(`User activity retrieval failed: ${error.message}`);
    }
  }

  /**
   * Batch update multiple sessions
   * @param {Array} sessionTokens - Array of session tokens
   * @param {Object} updates - Updates to apply
   * @returns {Promise<number>} Number of updated sessions
   */
  async batchUpdateSessions(sessionTokens, updates) {
    if (!sessionTokens.length) return 0;

    try {
      const tokenList = sessionTokens.map(token => `'${token}'`).join(',');
      const updateClauses = [];
      const params = {};

      if (updates.isActive !== undefined) {
        updateClauses.push('is_active = @isActive');
        params.isActive = updates.isActive;
      }

      if (updates.expirationReason) {
        updateClauses.push('expiration_reason = @expirationReason');
        params.expirationReason = updates.expirationReason;
      }

      if (updates.lastAccessed) {
        updateClauses.push('last_accessed_at = GETDATE()');
      }

      if (!updateClauses.length) {
        throw new Error('No valid updates provided');
      }

      const result = await this.db.query(`
        UPDATE tblUserSessions
        SET ${updateClauses.join(', ')}
        WHERE session_token IN (${tokenList})
      `, params);

      return result.rowsAffected[0] || 0;
    } catch (error) {
      console.error('❌ Failed to batch update sessions:', error);
      throw new Error(`Batch session update failed: ${error.message}`);
    }
  }

  /**
   * Delete old inactive sessions (cleanup)
   * @param {number} daysOld - Delete sessions older than this many days
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteOldSessions(daysOld = 30) {
    try {
      const result = await this.db.query(`
        DELETE FROM tblUserSessions
        WHERE is_active = 0 
          AND created_at < DATEADD(day, -@daysOld, GETDATE())
      `, { daysOld });

      const deletedCount = result.rowsAffected[0] || 0;
      if (deletedCount > 0) {
        console.log(`🗑️  Deleted ${deletedCount} old inactive sessions`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to delete old sessions:', error);
      throw new Error(`Old session deletion failed: ${error.message}`);
    }
  }
}

module.exports = SessionRepository;
