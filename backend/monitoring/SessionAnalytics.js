const EventEmitter = require('events');

/**
 * Session Analytics and Monitoring Service
 * 
 * Provides comprehensive session monitoring, metrics collection,
 * and analytics capabilities for the session management system.
 * 
 * Key Features:
 * - Real-time session metrics
 * - User behavior analytics
 * - Performance monitoring
 * - Security event tracking
 * - Customizable alerts and notifications
 * - Historical data analysis
 */
class SessionAnalytics extends EventEmitter {
  constructor(dependencies) {
    super();
    
    this.sessionService = dependencies.sessionService;
    this.sessionRepository = dependencies.sessionRepository;
    this.cacheManager = dependencies.cacheManager;
    
    // Analytics data storage
    this.metrics = {
      // Session metrics
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      averageSessionDuration: 0,
      
      // User metrics
      uniqueUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      
      // Performance metrics
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      
      // Security metrics
      failedLogins: 0,
      suspiciousActivity: 0,
      blockedIPs: new Set(),
      
      // Time-based metrics
      hourlyStats: new Map(),
      dailyStats: new Map(),
      weeklyStats: new Map()
    };
    
    // Configuration
    this.config = {
      enableRealTimeMetrics: true,
      enableUserBehaviorTracking: true,
      enableSecurityMonitoring: true,
      metricsRetentionDays: 30,
      alertThresholds: {
        highErrorRate: 0.05, // 5%
        lowCacheHitRate: 0.8, // 80%
        highFailedLoginRate: 0.1, // 10%
        maxConcurrentSessions: 1000
      }
    };
    
    // Internal state
    this.isRunning = false;
    this.metricsInterval = null;
    this.alertsEnabled = true;
    
    console.log('📊 Session Analytics initialized');
  }

  /**
   * Start analytics collection
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Session Analytics is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Load initial metrics
      await this.loadInitialMetrics();
      
      console.log('✅ Session Analytics started');
      this.emit('analytics:started');
      
    } catch (error) {
      console.error('❌ Failed to start Session Analytics:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop analytics collection
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🔄 Stopping Session Analytics...');
      
      this.isRunning = false;
      
      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }
      
      // Remove event listeners
      this.removeAllListeners();
      
      console.log('✅ Session Analytics stopped');
      this.emit('analytics:stopped');
      
    } catch (error) {
      console.error('❌ Error stopping Session Analytics:', error);
    }
  }

  /**
   * Setup event listeners for session events
   */
  setupEventListeners() {
    if (this.sessionService) {
      // Session lifecycle events
      this.sessionService.on('session:created', (event) => {
        this.trackSessionCreated(event);
      });
      
      this.sessionService.on('session:expired', (event) => {
        this.trackSessionExpired(event);
      });
      
      this.sessionService.on('session:heartbeat', (event) => {
        this.trackSessionHeartbeat(event);
      });
      
      this.sessionService.on('session:error', (event) => {
        this.trackSessionError(event);
      });
      
      // User events
      this.sessionService.on('user:session_created', (event) => {
        this.trackUserActivity(event);
      });
      
      this.sessionService.on('user:sessions_expired', (event) => {
        this.trackUserLogout(event);
      });
    }
  }

  /**
   * Start periodic metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 60000); // Collect metrics every minute
    
    console.log('📈 Started periodic metrics collection');
  }

  /**
   * Load initial metrics from database
   */
  async loadInitialMetrics() {
    try {
      if (this.sessionRepository) {
        const dbStats = await this.sessionRepository.getSessionStats();
        
        this.metrics.totalSessions = dbStats.total_sessions || 0;
        this.metrics.activeSessions = dbStats.active_sessions || 0;
        this.metrics.uniqueUsers = dbStats.unique_users || 0;
        this.metrics.activeUsers = dbStats.active_users || 0;
      }
      
      if (this.cacheManager) {
        const cacheMetrics = this.cacheManager.getMetrics();
        this.metrics.cacheHitRate = parseFloat(cacheMetrics.hitRate) / 100 || 0;
      }
      
      console.log('📊 Initial metrics loaded');
    } catch (error) {
      console.error('❌ Failed to load initial metrics:', error);
    }
  }

  /**
   * Collect current metrics
   */
  async collectMetrics() {
    try {
      const now = new Date();
      const hour = now.getHours();
      const day = now.toDateString();
      
      // Collect session metrics
      if (this.sessionRepository) {
        const dbStats = await this.sessionRepository.getSessionStats();
        this.updateSessionMetrics(dbStats);
      }
      
      // Collect cache metrics
      if (this.cacheManager) {
        const cacheMetrics = this.cacheManager.getMetrics();
        this.updateCacheMetrics(cacheMetrics);
      }
      
      // Update time-based metrics
      this.updateTimeBasedMetrics(hour, day);
      
      // Check for alerts
      this.checkAlerts();
      
      this.emit('metrics:collected', { timestamp: now, metrics: this.metrics });
      
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
      this.metrics.errorRate = (this.metrics.errorRate + 1) / 2; // Simple moving average
    }
  }

  /**
   * Track session creation
   */
  trackSessionCreated(event) {
    this.metrics.totalSessions++;
    this.metrics.activeSessions++;
    
    // Track user type (new vs returning)
    if (event.session && event.session.userId) {
      // This would require additional logic to determine if user is new
      // For now, we'll increment both counters
      this.metrics.newUsers++;
    }
    
    this.emit('analytics:session_created', event);
  }

  /**
   * Track session expiration
   */
  trackSessionExpired(event) {
    this.metrics.expiredSessions++;
    if (this.metrics.activeSessions > 0) {
      this.metrics.activeSessions--;
    }
    
    // Calculate session duration if available
    if (event.sessionData && event.sessionData.lastAccessed) {
      const duration = Date.now() - event.sessionData.lastAccessed.getTime();
      this.updateAverageSessionDuration(duration);
    }
    
    this.emit('analytics:session_expired', event);
  }

  /**
   * Track session heartbeat
   */
  trackSessionHeartbeat(event) {
    // Update activity metrics
    this.emit('analytics:heartbeat', event);
  }

  /**
   * Track session errors
   */
  trackSessionError(event) {
    this.metrics.errorRate = (this.metrics.errorRate + 1) / 2; // Simple moving average
    
    // Track security-related errors
    if (event.action === 'authenticate' || event.action === 'login') {
      this.metrics.failedLogins++;
    }
    
    this.emit('analytics:error', event);
  }

  /**
   * Track user activity
   */
  trackUserActivity(event) {
    this.metrics.activeUsers++;
    this.emit('analytics:user_activity', event);
  }

  /**
   * Track user logout
   */
  trackUserLogout(event) {
    if (this.metrics.activeUsers > 0) {
      this.metrics.activeUsers--;
    }
    this.emit('analytics:user_logout', event);
  }

  /**
   * Update session metrics from database stats
   */
  updateSessionMetrics(dbStats) {
    this.metrics.totalSessions = dbStats.total_sessions || 0;
    this.metrics.activeSessions = dbStats.active_sessions || 0;
    this.metrics.uniqueUsers = dbStats.unique_users || 0;
    this.metrics.activeUsers = dbStats.active_users || 0;
  }

  /**
   * Update cache metrics
   */
  updateCacheMetrics(cacheMetrics) {
    this.metrics.cacheHitRate = parseFloat(cacheMetrics.hitRate) / 100 || 0;
  }

  /**
   * Update time-based metrics
   */
  updateTimeBasedMetrics(hour, day) {
    // Update hourly stats
    if (!this.metrics.hourlyStats.has(hour)) {
      this.metrics.hourlyStats.set(hour, {
        sessions: 0,
        users: 0,
        errors: 0
      });
    }
    
    const hourlyStats = this.metrics.hourlyStats.get(hour);
    hourlyStats.sessions = this.metrics.activeSessions;
    hourlyStats.users = this.metrics.activeUsers;
    
    // Update daily stats
    if (!this.metrics.dailyStats.has(day)) {
      this.metrics.dailyStats.set(day, {
        totalSessions: 0,
        uniqueUsers: 0,
        errors: 0
      });
    }
    
    const dailyStats = this.metrics.dailyStats.get(day);
    dailyStats.totalSessions = this.metrics.totalSessions;
    dailyStats.uniqueUsers = this.metrics.uniqueUsers;
  }

  /**
   * Update average session duration
   */
  updateAverageSessionDuration(duration) {
    if (this.metrics.averageSessionDuration === 0) {
      this.metrics.averageSessionDuration = duration;
    } else {
      this.metrics.averageSessionDuration = (this.metrics.averageSessionDuration + duration) / 2;
    }
  }

  /**
   * Check for alert conditions
   */
  checkAlerts() {
    if (!this.alertsEnabled) return;
    
    const thresholds = this.config.alertThresholds;
    
    // High error rate alert
    if (this.metrics.errorRate > thresholds.highErrorRate) {
      this.emit('alert:high_error_rate', {
        current: this.metrics.errorRate,
        threshold: thresholds.highErrorRate
      });
    }
    
    // Low cache hit rate alert
    if (this.metrics.cacheHitRate < thresholds.lowCacheHitRate) {
      this.emit('alert:low_cache_hit_rate', {
        current: this.metrics.cacheHitRate,
        threshold: thresholds.lowCacheHitRate
      });
    }
    
    // High concurrent sessions alert
    if (this.metrics.activeSessions > thresholds.maxConcurrentSessions) {
      this.emit('alert:high_concurrent_sessions', {
        current: this.metrics.activeSessions,
        threshold: thresholds.maxConcurrentSessions
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      isRunning: this.isRunning
    };
  }

  /**
   * Get metrics for a specific time period
   */
  getTimeBasedMetrics(period = 'hourly') {
    switch (period) {
      case 'hourly':
        return Object.fromEntries(this.metrics.hourlyStats);
      case 'daily':
        return Object.fromEntries(this.metrics.dailyStats);
      case 'weekly':
        return Object.fromEntries(this.metrics.weeklyStats);
      default:
        return this.getMetrics();
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      averageSessionDuration: 0,
      uniqueUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      failedLogins: 0,
      suspiciousActivity: 0,
      blockedIPs: new Set(),
      hourlyStats: new Map(),
      dailyStats: new Map(),
      weeklyStats: new Map()
    };
    
    console.log('🔄 Analytics metrics reset');
    this.emit('analytics:reset');
  }

  /**
   * Enable or disable alerts
   */
  setAlertsEnabled(enabled) {
    this.alertsEnabled = enabled;
    console.log(`🔔 Alerts ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Shutdown analytics service
   */
  async shutdown() {
    await this.stop();
    console.log('🔒 Session Analytics shutdown complete');
  }
}

module.exports = SessionAnalytics;
