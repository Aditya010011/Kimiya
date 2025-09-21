const EventEmitter = require('events');

/**
 * Session Cleanup Service
 * 
 * Dedicated background service for session maintenance and cleanup tasks.
 * Runs independently to ensure session hygiene and database optimization.
 * 
 * Key Features:
 * - Automated session cleanup
 * - Database maintenance
 * - Performance optimization
 * - Configurable cleanup schedules
 * - Comprehensive logging and monitoring
 * - Graceful error handling
 */
class SessionCleanupService extends EventEmitter {
  constructor(dependencies) {
    super();
    
    this.sessionRepository = dependencies.sessionRepository;
    this.cacheManager = dependencies.cacheManager;
    this.serviceRegistry = dependencies.serviceRegistry;
    
    // Configuration
    this.config = {
      // Cleanup intervals
      expiredSessionsInterval: 5 * 60 * 1000, // 5 minutes
      inactiveSessionsInterval: 10 * 60 * 1000, // 10 minutes
      oldSessionsInterval: 60 * 60 * 1000, // 1 hour
      cacheCleanupInterval: 15 * 60 * 1000, // 15 minutes
      
      // Cleanup thresholds
      heartbeatTimeout: 5 * 60 * 1000, // 5 minutes
      oldSessionDays: 30, // Delete sessions older than 30 days
      batchSize: 1000, // Process sessions in batches
      
      // Performance settings
      enableBatchProcessing: true,
      enableMetrics: true,
      maxConcurrentCleanups: 3
    };

    // Internal state
    this.intervals = new Map();
    this.isRunning = false;
    this.activeCleanups = 0;
    this.metrics = {
      totalCleanups: 0,
      expiredSessions: 0,
      inactiveSessions: 0,
      deletedSessions: 0,
      cacheCleanups: 0,
      errors: 0,
      lastCleanup: null,
      averageCleanupTime: 0
    };

    console.log('🧹 Session Cleanup Service initialized');
  }

  /**
   * Start the cleanup service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Session Cleanup Service is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Schedule different types of cleanup
      this.scheduleExpiredSessionsCleanup();
      this.scheduleInactiveSessionsCleanup();
      this.scheduleOldSessionsCleanup();
      this.scheduleCacheCleanup();

      // Setup event listeners
      this.setupEventListeners();

      console.log('✅ Session Cleanup Service started');
      this.emit('service:started');
      
      // Run initial cleanup
      setTimeout(() => this.runInitialCleanup(), 5000);
      
    } catch (error) {
      console.error('❌ Failed to start Session Cleanup Service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the cleanup service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🔄 Stopping Session Cleanup Service...');
      
      this.isRunning = false;
      
      // Clear all intervals
      for (const [name, interval] of this.intervals.entries()) {
        clearInterval(interval);
        console.log(`🔒 Stopped ${name} cleanup interval`);
      }
      this.intervals.clear();

      // Wait for active cleanups to complete
      while (this.activeCleanups > 0) {
        console.log(`⏳ Waiting for ${this.activeCleanups} active cleanups to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Session Cleanup Service stopped');
      this.emit('service:stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Session Cleanup Service:', error);
    }
  }

  /**
   * Schedule expired sessions cleanup
   */
  scheduleExpiredSessionsCleanup() {
    const interval = setInterval(async () => {
      if (this.activeCleanups >= this.config.maxConcurrentCleanups) {
        console.log('⏳ Skipping expired sessions cleanup - too many active cleanups');
        return;
      }
      
      await this.cleanupExpiredSessions();
    }, this.config.expiredSessionsInterval);

    this.intervals.set('expiredSessions', interval);
    console.log(`📅 Scheduled expired sessions cleanup (every ${this.config.expiredSessionsInterval / 1000}s)`);
  }

  /**
   * Schedule inactive sessions cleanup
   */
  scheduleInactiveSessionsCleanup() {
    const interval = setInterval(async () => {
      if (this.activeCleanups >= this.config.maxConcurrentCleanups) {
        console.log('⏳ Skipping inactive sessions cleanup - too many active cleanups');
        return;
      }
      
      await this.cleanupInactiveSessions();
    }, this.config.inactiveSessionsInterval);

    this.intervals.set('inactiveSessions', interval);
    console.log(`📅 Scheduled inactive sessions cleanup (every ${this.config.inactiveSessionsInterval / 1000}s)`);
  }

  /**
   * Schedule old sessions cleanup
   */
  scheduleOldSessionsCleanup() {
    const interval = setInterval(async () => {
      if (this.activeCleanups >= this.config.maxConcurrentCleanups) {
        console.log('⏳ Skipping old sessions cleanup - too many active cleanups');
        return;
      }
      
      await this.cleanupOldSessions();
    }, this.config.oldSessionsInterval);

    this.intervals.set('oldSessions', interval);
    console.log(`📅 Scheduled old sessions cleanup (every ${this.config.oldSessionsInterval / 1000}s)`);
  }

  /**
   * Schedule cache cleanup
   */
  scheduleCacheCleanup() {
    const interval = setInterval(async () => {
      await this.cleanupCache();
    }, this.config.cacheCleanupInterval);

    this.intervals.set('cache', interval);
    console.log(`📅 Scheduled cache cleanup (every ${this.config.cacheCleanupInterval / 1000}s)`);
  }

  /**
   * Run initial cleanup on service start
   */
  async runInitialCleanup() {
    console.log('🚀 Running initial session cleanup...');
    
    try {
      await Promise.all([
        this.cleanupExpiredSessions(),
        this.cleanupInactiveSessions(),
        this.cleanupCache()
      ]);
      
      console.log('✅ Initial session cleanup completed');
    } catch (error) {
      console.error('❌ Initial cleanup failed:', error);
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    const startTime = Date.now();
    this.activeCleanups++;
    
    try {
      console.log('🧹 Starting expired sessions cleanup...');
      
      const cleanedCount = await this.sessionRepository.cleanupExpiredSessions();
      
      if (cleanedCount > 0) {
        // Remove from cache
        // Note: This is a simplified approach. In production, you might want
        // to maintain a mapping of expired sessions for more efficient cache cleanup
        console.log(`🗑️  Cleaned ${cleanedCount} expired sessions from database`);
        
        this.metrics.expiredSessions += cleanedCount;
        this.emit('cleanup:expired', { count: cleanedCount });
      }
      
      this.updateMetrics('expired', startTime);
      
    } catch (error) {
      console.error('❌ Expired sessions cleanup failed:', error);
      this.metrics.errors++;
      this.emit('cleanup:error', { type: 'expired', error: error.message });
    } finally {
      this.activeCleanups--;
    }
  }

  /**
   * Cleanup inactive sessions (no heartbeat)
   */
  async cleanupInactiveSessions() {
    const startTime = Date.now();
    this.activeCleanups++;
    
    try {
      console.log('💓 Starting inactive sessions cleanup...');
      
      const expiredCount = await this.sessionRepository.expireInactiveSessions(
        this.config.heartbeatTimeout
      );
      
      if (expiredCount > 0) {
        console.log(`💔 Expired ${expiredCount} inactive sessions`);
        
        this.metrics.inactiveSessions += expiredCount;
        this.emit('cleanup:inactive', { count: expiredCount });
      }
      
      this.updateMetrics('inactive', startTime);
      
    } catch (error) {
      console.error('❌ Inactive sessions cleanup failed:', error);
      this.metrics.errors++;
      this.emit('cleanup:error', { type: 'inactive', error: error.message });
    } finally {
      this.activeCleanups--;
    }
  }

  /**
   * Cleanup old sessions (permanent deletion)
   */
  async cleanupOldSessions() {
    const startTime = Date.now();
    this.activeCleanups++;
    
    try {
      console.log('🗑️  Starting old sessions cleanup...');
      
      const deletedCount = await this.sessionRepository.deleteOldSessions(
        this.config.oldSessionDays
      );
      
      if (deletedCount > 0) {
        console.log(`🗑️  Permanently deleted ${deletedCount} old sessions`);
        
        this.metrics.deletedSessions += deletedCount;
        this.emit('cleanup:deleted', { count: deletedCount });
      }
      
      this.updateMetrics('deleted', startTime);
      
    } catch (error) {
      console.error('❌ Old sessions cleanup failed:', error);
      this.metrics.errors++;
      this.emit('cleanup:error', { type: 'deleted', error: error.message });
    } finally {
      this.activeCleanups--;
    }
  }

  /**
   * Cleanup cache
   */
  async cleanupCache() {
    const startTime = Date.now();
    
    try {
      console.log('💾 Starting cache cleanup...');
      
      // Cleanup expired entries from cache
      this.cacheManager.cleanup();
      
      this.metrics.cacheCleanups++;
      this.emit('cleanup:cache', { timestamp: new Date() });
      
      this.updateMetrics('cache', startTime);
      
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      this.metrics.errors++;
      this.emit('cleanup:error', { type: 'cache', error: error.message });
    }
  }

  /**
   * Update cleanup metrics
   */
  updateMetrics(type, startTime) {
    const duration = Date.now() - startTime;
    this.metrics.totalCleanups++;
    this.metrics.lastCleanup = new Date();
    
    // Update average cleanup time
    if (this.metrics.averageCleanupTime === 0) {
      this.metrics.averageCleanupTime = duration;
    } else {
      this.metrics.averageCleanupTime = (this.metrics.averageCleanupTime + duration) / 2;
    }
    
    console.log(`⏱️  ${type} cleanup completed in ${duration}ms`);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for service registry shutdown
    if (this.serviceRegistry) {
      this.serviceRegistry.on('registry:shutdown', () => {
        this.stop();
      });
    }

    // Setup internal event handlers
    this.on('cleanup:error', (event) => {
      console.error(`🚨 Cleanup Error [${event.type}]:`, event.error);
    });

    this.on('cleanup:expired', (event) => {
      console.log(`📊 Expired sessions cleanup: ${event.count} sessions`);
    });

    this.on('cleanup:inactive', (event) => {
      console.log(`📊 Inactive sessions cleanup: ${event.count} sessions`);
    });

    this.on('cleanup:deleted', (event) => {
      console.log(`📊 Old sessions deletion: ${event.count} sessions`);
    });
  }

  /**
   * Get cleanup metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isRunning: this.isRunning,
      activeCleanups: this.activeCleanups,
      scheduledIntervals: Array.from(this.intervals.keys()),
      config: {
        expiredSessionsInterval: this.config.expiredSessionsInterval,
        inactiveSessionsInterval: this.config.inactiveSessionsInterval,
        oldSessionsInterval: this.config.oldSessionsInterval,
        cacheCleanupInterval: this.config.cacheCleanupInterval,
        heartbeatTimeout: this.config.heartbeatTimeout,
        oldSessionDays: this.config.oldSessionDays
      }
    };
  }

  /**
   * Force run all cleanup tasks
   */
  async forceCleanup() {
    if (!this.isRunning) {
      throw new Error('Cleanup service is not running');
    }

    console.log('🚀 Force running all cleanup tasks...');
    
    try {
      await Promise.all([
        this.cleanupExpiredSessions(),
        this.cleanupInactiveSessions(),
        this.cleanupOldSessions(),
        this.cleanupCache()
      ]);
      
      console.log('✅ Force cleanup completed');
      this.emit('cleanup:force_complete');
      
    } catch (error) {
      console.error('❌ Force cleanup failed:', error);
      this.emit('cleanup:error', { type: 'force', error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown the cleanup service
   */
  async shutdown() {
    await this.stop();
    console.log('🔒 Session Cleanup Service shutdown complete');
  }
}

module.exports = SessionCleanupService;
