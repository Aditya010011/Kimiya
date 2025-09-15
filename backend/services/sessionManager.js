let databaseService;
try {
  databaseService = require('./database');
} catch (error) {
  console.warn('SessionManager: Database service not available, running in limited mode');
  databaseService = null;
}

/**
 * Session Management Service
 * Handles user session lifecycle, cleanup, and online/offline status tracking
 */
class SessionManager {
  constructor() {
    this.cleanupInterval = null;
    this.heartbeatInterval = null;
    this.activeSessions = new Map(); // Track active sessions in memory
    
    // Configuration
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.CLEANUP_INTERVAL = 5 * 60 * 1000; // Run cleanup every 5 minutes
    this.HEARTBEAT_INTERVAL = 60 * 1000; // Check heartbeats every minute
    this.HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes without heartbeat = offline
  }

  /**
   * Initialize the session manager
   */
  async initialize() {
    console.log('🔄 Initializing Session Manager...');

    if (!databaseService) {
      console.warn('⚠️  Session Manager: Running in limited mode (no database)');
      return;
    }

    try {
      // Start periodic cleanup
      this.startPeriodicCleanup();

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      // Load existing active sessions into memory
      await this.loadActiveSessions();

      console.log('✅ Session Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Session Manager:', error);
      throw error;
    }
  }

  /**
   * Load existing active sessions from database into memory
   */
  async loadActiveSessions() {
    if (!databaseService) {
      console.log('📊 No database available, starting with empty session cache');
      return;
    }

    try {
      const result = await databaseService.query(`
        SELECT user_id, session_token, last_accessed_at, expires_at
        FROM tblUserSessions
        WHERE is_active = 1 AND expires_at > GETDATE()
      `);

      result.recordset.forEach(session => {
        this.activeSessions.set(session.session_token, {
          userId: session.user_id,
          lastAccessed: new Date(session.last_accessed_at),
          expiresAt: new Date(session.expires_at),
          lastHeartbeat: new Date(session.last_accessed_at)
        });
      });

      console.log(`📊 Loaded ${this.activeSessions.size} active sessions into memory`);
    } catch (error) {
      console.error('❌ Failed to load active sessions:', error);
    }
  }

  /**
   * Start periodic session cleanup
   */
  startPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);

    console.log(`🧹 Started periodic session cleanup (every ${this.CLEANUP_INTERVAL / 1000}s)`);
  }

  /**
   * Start heartbeat monitoring
   */
  startHeartbeatMonitoring() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.checkHeartbeats();
    }, this.HEARTBEAT_INTERVAL);

    console.log(`💓 Started heartbeat monitoring (every ${this.HEARTBEAT_INTERVAL / 1000}s)`);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const now = new Date();
      let cleanedCount = 0;

      // Clean up expired sessions from memory
      for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
        if (sessionData.expiresAt <= now) {
          this.activeSessions.delete(sessionToken);
          cleanedCount++;
        }
      }

      // Clean up expired sessions from database
      const result = await databaseService.query(`
        UPDATE tblUserSessions
        SET is_active = 0, last_accessed_at = GETDATE()
        WHERE is_active = 1 AND expires_at <= GETDATE()
      `);

      const dbCleanedCount = result.rowsAffected[0] || 0;
      
      if (cleanedCount > 0 || dbCleanedCount > 0) {
        console.log(`🧹 Session cleanup: ${cleanedCount} from memory, ${dbCleanedCount} from database`);
      }

      return { memoryCleanup: cleanedCount, databaseCleanup: dbCleanedCount };
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      return { memoryCleanup: 0, databaseCleanup: 0 };
    }
  }

  /**
   * Check for sessions that haven't sent heartbeats
   */
  async checkHeartbeats() {
    try {
      const now = new Date();
      const heartbeatTimeout = new Date(now.getTime() - this.HEARTBEAT_TIMEOUT);
      let expiredCount = 0;

      // Check sessions in memory for missing heartbeats
      for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
        if (sessionData.lastHeartbeat <= heartbeatTimeout) {
          // Mark session as inactive due to missing heartbeat
          await this.expireSession(sessionToken, 'heartbeat_timeout');
          this.activeSessions.delete(sessionToken);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`💓 Expired ${expiredCount} sessions due to missing heartbeats`);
      }

      return expiredCount;
    } catch (error) {
      console.error('❌ Heartbeat check failed:', error);
      return 0;
    }
  }

  /**
   * Record a heartbeat for a session
   */
  async recordHeartbeat(sessionToken, userId) {
    try {
      const now = new Date();
      
      // Update in memory
      if (this.activeSessions.has(sessionToken)) {
        this.activeSessions.get(sessionToken).lastHeartbeat = now;
        this.activeSessions.get(sessionToken).lastAccessed = now;
      }

      // Update in database
      await databaseService.query(`
        UPDATE tblUserSessions
        SET last_accessed_at = GETDATE()
        WHERE session_token = @sessionToken AND user_id = @userId AND is_active = 1
      `, { sessionToken, userId });

      return true;
    } catch (error) {
      console.error('❌ Failed to record heartbeat:', error);
      return false;
    }
  }

  /**
   * Create a new session
   */
  async createSession(userId, sessionToken, expiresAt, ipAddress, userAgent) {
    try {
      const now = new Date();
      
      // Add to memory
      this.activeSessions.set(sessionToken, {
        userId,
        lastAccessed: now,
        expiresAt: new Date(expiresAt),
        lastHeartbeat: now
      });

      // Add to database (this is already handled in auth.js, but we track it here too)
      console.log(`📝 Session created for user ${userId}: ${sessionToken.substring(0, 8)}...`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      return false;
    }
  }

  /**
   * Expire a specific session
   */
  async expireSession(sessionToken, reason = 'manual') {
    try {
      // Remove from memory
      this.activeSessions.delete(sessionToken);

      // Update database
      await databaseService.query(`
        UPDATE tblUserSessions
        SET is_active = 0, last_accessed_at = GETDATE()
        WHERE session_token = @sessionToken
      `, { sessionToken });

      console.log(`🔒 Session expired: ${sessionToken.substring(0, 8)}... (reason: ${reason})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to expire session:', error);
      return false;
    }
  }

  /**
   * Expire all sessions for a user (logout all devices)
   */
  async expireUserSessions(userId, reason = 'logout_all') {
    try {
      // Remove from memory
      for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
        if (sessionData.userId === userId) {
          this.activeSessions.delete(sessionToken);
        }
      }

      // Update database
      const result = await databaseService.query(`
        UPDATE tblUserSessions
        SET is_active = 0, last_accessed_at = GETDATE()
        WHERE user_id = @userId AND is_active = 1
      `, { userId });

      const expiredCount = result.rowsAffected[0] || 0;
      console.log(`🔒 Expired ${expiredCount} sessions for user ${userId} (reason: ${reason})`);
      
      return expiredCount;
    } catch (error) {
      console.error('❌ Failed to expire user sessions:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;

    for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
      if (sessionData.expiresAt > now) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      totalInMemory: this.activeSessions.size,
      active: activeCount,
      expired: expiredCount,
      lastCleanup: this.lastCleanup || null
    };
  }

  /**
   * Shutdown the session manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.activeSessions.clear();
    console.log('🔄 Session Manager shutdown complete');
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;
