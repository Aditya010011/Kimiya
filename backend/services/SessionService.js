const EventEmitter = require('events');

/**
 * Event-Driven Session Service
 * 
 * Core session management service that uses events for communication
 * instead of direct method calls to eliminate circular dependencies.
 * 
 * Key Features:
 * - Event-driven architecture
 * - No circular dependencies
 * - High-performance caching
 * - Automatic session cleanup
 * - Comprehensive session lifecycle management
 * - Real-time session monitoring
 */
class SessionService extends EventEmitter {
  constructor(dependencies) {
    super();
    
    this.sessionRepository = dependencies.sessionRepository;
    this.cacheManager = dependencies.cacheManager;
    this.serviceRegistry = dependencies.serviceRegistry;
    
    // Configuration
    this.config = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      heartbeatTimeout: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      maxSessionsPerUser: 10,
      enableSessionAnalytics: true
    };

    // Internal state
    this.cleanupInterval = null;
    this.isInitialized = false;
    this.sessionAnalytics = {
      created: 0,
      expired: 0,
      heartbeats: 0,
      cleanups: 0
    };


  }

  /**
   * Initialize the session service
   */
  async initialize() {
    try {
      // Initialize cache manager
      await this.cacheManager.initialize();

      // Start periodic cleanup
      this.startPeriodicCleanup();

      // Set up event listeners
      this.setupEventListeners();

      // Load active sessions into cache
      await this.warmupCache();

      this.isInitialized = true;

      
      this.emit('service:ready');
    } catch (error) {
      console.error('❌ Failed to initialize Session Service:', error);
      throw error;
    }
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session creation data
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
        deviceInfo
      } = sessionData;

      // Check session limit per user
      const activeSessions = await this.sessionRepository.getActiveSessionsByUser(userId);
      if (activeSessions.length >= this.config.maxSessionsPerUser) {
        // Expire oldest session
        const oldestSession = activeSessions[activeSessions.length - 1];
        await this.expireSession(oldestSession.session_token, 'session_limit_exceeded');
      }

      // Create session in database
      const session = await this.sessionRepository.createSession({
        userId,
        sessionToken,
        expiresAt,
        ipAddress,
        userAgent,
        deviceInfo
      });

      // Cache the session
      const cacheData = {
        userId: session.user_id,
        sessionToken: session.session_token,
        expiresAt: new Date(session.expires_at),
        lastAccessed: new Date(session.last_accessed_at),
        lastHeartbeat: new Date(session.last_accessed_at),
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        deviceInfo: session.device_info ? JSON.parse(session.device_info) : null
      };

      await this.cacheManager.set(sessionToken, cacheData);

      // Update analytics
      this.sessionAnalytics.created++;

      // Emit events
      this.emit('session:created', { session: cacheData });
      this.emit('user:session_created', { userId, sessionToken });


      
      return session;
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      this.emit('session:error', { action: 'create', error: error.message });
      throw error;
    }
  }

  /**
   * Get session by token
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object|null>} Session data or null
   */
  async getSession(sessionToken) {
    try {
      // Try cache first
      let sessionData = await this.cacheManager.get(sessionToken);
      
      if (!sessionData) {
        // Fallback to database
        const dbSession = await this.sessionRepository.getSessionByToken(sessionToken);
        if (dbSession && dbSession.is_active && new Date(dbSession.expires_at) > new Date()) {
          sessionData = {
            userId: dbSession.user_id,
            sessionToken: dbSession.session_token,
            expiresAt: new Date(dbSession.expires_at),
            lastAccessed: new Date(dbSession.last_accessed_at),
            lastHeartbeat: new Date(dbSession.last_accessed_at),
            ipAddress: dbSession.ip_address,
            userAgent: dbSession.user_agent,
            deviceInfo: dbSession.device_info ? JSON.parse(dbSession.device_info) : null
          };

          // Cache for future requests
          await this.cacheManager.set(sessionToken, sessionData);
        }
      }

      // Check if session is expired
      if (sessionData && sessionData.expiresAt <= new Date()) {
        await this.expireSession(sessionToken, 'expired');
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      this.emit('session:error', { action: 'get', sessionToken, error: error.message });
      return null;
    }
  }

  /**
   * Record session heartbeat
   * @param {string} sessionToken - Session token
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async recordHeartbeat(sessionToken, userId) {
    try {
      // Get session from cache
      let sessionData = await this.cacheManager.get(sessionToken);

      // If not in cache, try to load from database (including inactive sessions)
      if (!sessionData) {
        const dbSession = await this.sessionRepository.getSessionByToken(sessionToken);
        if (!dbSession) {
          return false;
        }

        // Check if session is expired (not just inactive)
        if (new Date(dbSession.expires_at) <= new Date()) {
          return false;
        }

        // Create session data for cache (even if it was inactive)
        sessionData = {
          userId: dbSession.user_id,
          sessionToken: dbSession.session_token,
          expiresAt: new Date(dbSession.expires_at),
          lastAccessed: new Date(dbSession.last_accessed_at),
          lastHeartbeat: new Date(),
          ipAddress: dbSession.ip_address,
          userAgent: dbSession.user_agent,
          deviceInfo: dbSession.device_info ? JSON.parse(dbSession.device_info) : null
        };
      }

      // Verify user ID matches
      if (sessionData && sessionData.userId !== userId) {
        console.warn(`⚠️  Heartbeat user ID mismatch: ${userId} vs ${sessionData.userId}`);
        return false;
      }

      // Update database (this will reactivate inactive sessions if not expired)
      const success = await this.sessionRepository.updateLastAccessed(sessionToken, userId);

      if (success) {
        // Update cache
        sessionData.lastAccessed = new Date();
        sessionData.lastHeartbeat = new Date();
        await this.cacheManager.set(sessionToken, sessionData);

        // Update analytics
        this.sessionAnalytics.heartbeats++;

        // Emit events
        this.emit('session:heartbeat', { sessionToken, userId });
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to record heartbeat:', error);
      this.emit('session:error', { action: 'heartbeat', sessionToken, userId, error: error.message });
      return false;
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
      // Get session data for events
      const sessionData = await this.cacheManager.get(sessionToken);

      // Update database
      const success = await this.sessionRepository.expireSession(sessionToken, reason);
      
      if (success) {
        // Remove from cache
        await this.cacheManager.delete(sessionToken);

        // Update analytics
        this.sessionAnalytics.expired++;

        // Emit events
        this.emit('session:expired', { sessionToken, reason, sessionData });
        if (sessionData) {
          this.emit('user:session_expired', { 
            userId: sessionData.userId, 
            sessionToken, 
            reason 
          });
        }


      }

      return success;
    } catch (error) {
      console.error('❌ Failed to expire session:', error);
      this.emit('session:error', { action: 'expire', sessionToken, reason, error: error.message });
      return false;
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
      // Get active sessions for events
      const activeSessions = await this.sessionRepository.getActiveSessionsByUser(userId);

      // Update database
      const expiredCount = await this.sessionRepository.expireUserSessions(userId, reason);
      
      if (expiredCount > 0) {
        // Remove from cache
        await this.cacheManager.deleteUserSessions(userId);

        // Update analytics
        this.sessionAnalytics.expired += expiredCount;

        // Emit events
        this.emit('user:sessions_expired', { userId, reason, count: expiredCount });
        
        for (const session of activeSessions) {
          this.emit('session:expired', { 
            sessionToken: session.session_token, 
            reason,
            sessionData: { userId }
          });
        }


      }

      return expiredCount;
    } catch (error) {
      console.error('❌ Failed to expire user sessions:', error);
      this.emit('session:error', { action: 'expire_user', userId, reason, error: error.message });
      return 0;
    }
  }

  /**
   * Get active sessions for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  async getUserSessions(userId) {
    try {
      return await this.sessionRepository.getActiveSessionsByUser(userId);
    } catch (error) {
      console.error('❌ Failed to get user sessions:', error);
      this.emit('session:error', { action: 'get_user_sessions', userId, error: error.message });
      return [];
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats() {
    try {
      const dbStats = await this.sessionRepository.getSessionStats();
      const cacheMetrics = this.cacheManager.getMetrics();
      
      return {
        database: dbStats,
        cache: cacheMetrics,
        analytics: this.sessionAnalytics,
        service: {
          isInitialized: this.isInitialized,
          uptime: process.uptime()
        }
      };
    } catch (error) {
      console.error('❌ Failed to get session statistics:', error);
      this.emit('session:error', { action: 'get_stats', error: error.message });
      return null;
    }
  }

  /**
   * Warmup cache with active sessions
   */
  async warmupCache() {
    try {
      // This is a simplified warmup - in production, you might want to
      // load only recently active sessions or implement a more sophisticated strategy
      console.log('🔥 Warming up session cache...');
      
      // For now, we'll let sessions be loaded on-demand
      // This prevents overwhelming the cache on startup
      
      console.log('✅ Session cache warmup complete');
    } catch (error) {
      console.error('❌ Failed to warmup cache:', error);
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, this.config.cleanupInterval);

    console.log(`🧹 Started periodic session cleanup (every ${this.config.cleanupInterval / 1000}s)`);
  }

  /**
   * Perform session cleanup
   */
  async performCleanup() {
    try {
      // Clean expired sessions
      const expiredCount = await this.sessionRepository.cleanupExpiredSessions();
      
      // Clean inactive sessions (no heartbeat)
      const inactiveCount = await this.sessionRepository.expireInactiveSessions(
        this.config.heartbeatTimeout
      );

      // Clean cache
      this.cacheManager.cleanup();

      const totalCleaned = expiredCount + inactiveCount;
      if (totalCleaned > 0) {
        this.sessionAnalytics.cleanups++;
        this.emit('session:cleanup', { expiredCount, inactiveCount, totalCleaned });
      }

    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      this.emit('session:error', { action: 'cleanup', error: error.message });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for service registry events
    if (this.serviceRegistry) {
      this.serviceRegistry.on('registry:shutdown', () => {
        this.shutdown();
      });
    }

    // Setup internal event handlers
    this.on('session:error', (event) => {
      console.error(`🚨 Session Service Error [${event.action}]:`, event.error);
    });
  }

  /**
   * Shutdown the session service
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down Session Service...');

      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Shutdown cache manager
      if (this.cacheManager) {
        await this.cacheManager.shutdown();
      }

      this.isInitialized = false;
      this.emit('service:shutdown');
      
      console.log('🔒 Session Service shutdown complete');
    } catch (error) {
      console.error('❌ Error shutting down Session Service:', error);
    }
  }
}

module.exports = SessionService;
