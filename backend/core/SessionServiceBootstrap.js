/**
 * Session Service Bootstrap
 * 
 * Registers and initializes all session-related services in the correct order
 * without circular dependencies. This file sets up the entire session management
 * architecture using the Service Registry pattern.
 * 
 * Key Features:
 * - Dependency injection setup
 * - Service registration and initialization
 * - Configuration management
 * - Error handling and recovery
 * - Health monitoring setup
 */

const serviceRegistry = require('./ServiceRegistry');
const SessionRepository = require('../repositories/SessionRepository');
const SessionCacheManager = require('../services/SessionCacheManager');
const SessionService = require('../services/SessionService');
const SessionCleanupService = require('../services/SessionCleanupService');
const SessionMiddlewareFactory = require('../middleware/SessionMiddlewareFactory');

/**
 * Bootstrap the session management system
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Initialized services
 */
async function bootstrapSessionServices(config = {}) {
  try {
    console.log('🚀 Bootstrapping Session Management System...');

    // Configuration with defaults
    const sessionConfig = {
      // Cache configuration
      cache: {
        maxMemorySize: config.cache?.maxMemorySize || 10000,
        ttl: config.cache?.ttl || 30 * 60 * 1000, // 30 minutes
        cleanupInterval: config.cache?.cleanupInterval || 5 * 60 * 1000, // 5 minutes
        enableRedis: config.cache?.enableRedis || false,
        redisConfig: config.cache?.redisConfig || {}
      },
      
      // Session service configuration
      session: {
        sessionTimeout: config.session?.sessionTimeout || 30 * 60 * 1000, // 30 minutes
        heartbeatTimeout: config.session?.heartbeatTimeout || 5 * 60 * 1000, // 5 minutes
        maxSessionsPerUser: config.session?.maxSessionsPerUser || 10,
        enableSessionAnalytics: config.session?.enableSessionAnalytics !== false
      },
      
      // Cleanup service configuration
      cleanup: {
        expiredSessionsInterval: config.cleanup?.expiredSessionsInterval || 5 * 60 * 1000, // 5 minutes
        inactiveSessionsInterval: config.cleanup?.inactiveSessionsInterval || 10 * 60 * 1000, // 10 minutes
        oldSessionsInterval: config.cleanup?.oldSessionsInterval || 60 * 60 * 1000, // 1 hour
        heartbeatTimeout: config.cleanup?.heartbeatTimeout || 5 * 60 * 1000, // 5 minutes
        oldSessionDays: config.cleanup?.oldSessionDays || 30
      },
      
      // Middleware configuration
      middleware: {
        enableSessionTracking: config.middleware?.enableSessionTracking !== false,
        enableHeartbeat: config.middleware?.enableHeartbeat !== false,
        requireActiveSession: config.middleware?.requireActiveSession !== false
      }
    };

    // Register Database Service (should already be registered)
    if (!serviceRegistry.has('database')) {
      console.log('📊 Registering database service...');
      serviceRegistry.register('database', () => {
        return require('../services/database');
      }, {
        singleton: true,
        priority: 100 // Highest priority
      });
    }

    // Register Session Repository
    console.log('📊 Registering Session Repository...');
    serviceRegistry.register('sessionRepository', (dependencies) => {
      return new SessionRepository(dependencies.database);
    }, {
      dependencies: ['database'],
      singleton: true,
      priority: 90,
      healthCheck: (service) => {
        return service && service.db && typeof service.db.query === 'function';
      }
    });

    // Register Session Cache Manager
    console.log('💾 Registering Session Cache Manager...');
    serviceRegistry.register('sessionCacheManager', () => {
      return new SessionCacheManager(sessionConfig.cache);
    }, {
      singleton: true,
      priority: 80,
      healthCheck: (service) => {
        return service && typeof service.get === 'function';
      }
    });

    // Register Session Service
    console.log('🔐 Registering Session Service...');
    serviceRegistry.register('sessionService', (dependencies) => {
      return new SessionService({
        sessionRepository: dependencies.sessionRepository,
        cacheManager: dependencies.sessionCacheManager,
        serviceRegistry: serviceRegistry
      });
    }, {
      dependencies: ['sessionRepository', 'sessionCacheManager'],
      singleton: true,
      priority: 70,
      healthCheck: (service) => {
        return service && service.isInitialized;
      }
    });

    // Register Session Cleanup Service
    console.log('🧹 Registering Session Cleanup Service...');
    serviceRegistry.register('sessionCleanupService', (dependencies) => {
      return new SessionCleanupService({
        sessionRepository: dependencies.sessionRepository,
        cacheManager: dependencies.sessionCacheManager,
        serviceRegistry: serviceRegistry
      });
    }, {
      dependencies: ['sessionRepository', 'sessionCacheManager'],
      singleton: true,
      priority: 60,
      healthCheck: (service) => {
        return service && service.isRunning;
      }
    });

    // Register Session Middleware Factory
    console.log('🏭 Registering Session Middleware Factory...');
    serviceRegistry.register('sessionMiddlewareFactory', () => {
      return new SessionMiddlewareFactory(serviceRegistry);
    }, {
      singleton: true,
      priority: 50,
      healthCheck: (service) => {
        return service && typeof service.createAuthenticateToken === 'function';
      }
    });

    // Initialize all services
    console.log('⚡ Initializing all session services...');
    const initResults = await serviceRegistry.initializeAll();

    // Check for failed initializations
    const failedServices = initResults.filter(r => r.status === 'failed');
    if (failedServices.length > 0) {
      console.error('❌ Some session services failed to initialize:', failedServices);
      throw new Error(`Failed to initialize services: ${failedServices.map(s => s.name).join(', ')}`);
    }

    // Get initialized services
    const services = {
      registry: serviceRegistry,
      sessionRepository: await serviceRegistry.get('sessionRepository'),
      cacheManager: await serviceRegistry.get('sessionCacheManager'),
      sessionService: await serviceRegistry.get('sessionService'),
      cleanupService: await serviceRegistry.get('sessionCleanupService'),
      middlewareFactory: await serviceRegistry.get('sessionMiddlewareFactory')
    };

    // Initialize session service
    await services.sessionService.initialize();

    // Start cleanup service
    await services.cleanupService.start();

    // Setup health monitoring
    setupHealthMonitoring(services);

    console.log('✅ Session Management System bootstrap complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Session Services Status:');
    console.log(`   • Session Repository: ✅ Ready`);
    console.log(`   • Cache Manager: ✅ Ready (${services.cacheManager.size()} sessions cached)`);
    console.log(`   • Session Service: ✅ Ready`);
    console.log(`   • Cleanup Service: ✅ Running`);
    console.log(`   • Middleware Factory: ✅ Ready`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return services;

  } catch (error) {
    console.error('❌ Failed to bootstrap Session Management System:', error);
    throw error;
  }
}

/**
 * Setup health monitoring for session services
 * @param {Object} services - Initialized services
 */
function setupHealthMonitoring(services) {
  // Setup periodic health checks
  const healthCheckInterval = setInterval(async () => {
    try {
      const healthResults = await services.registry.healthCheck();
      const unhealthyServices = Object.entries(healthResults)
        .filter(([, result]) => result.status !== 'healthy' && result.status !== 'initialized')
        .map(([name]) => name);

      if (unhealthyServices.length > 0) {
        console.warn('⚠️  Unhealthy session services detected:', unhealthyServices);
        services.sessionService.emit('health:warning', { unhealthyServices });
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }, 60000); // Check every minute

  // Setup service event monitoring
  services.sessionService.on('session:error', (event) => {
    console.error(`🚨 Session Service Error [${event.action}]:`, event.error);
  });

  services.cleanupService.on('cleanup:error', (event) => {
    console.error(`🚨 Cleanup Service Error [${event.type}]:`, event.error);
  });

  // Cleanup health monitoring on shutdown
  services.registry.on('registry:shutdown', () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  });
}

/**
 * Get session management middleware
 * @param {Object} services - Initialized services
 * @returns {Object} Middleware functions
 */
function getSessionMiddleware(services) {
  const factory = services.middlewareFactory;
  
  return {
    // Authentication middleware
    authenticateToken: factory.createAuthenticateToken(),
    authenticateTokenOptional: factory.createOptionalAuth(),
    
    // Authorization middleware
    requireAdmin: factory.createRequireAdmin(),
    requireRole: (roles) => factory.createRequireRole(roles),
    
    // Session middleware
    validateSession: factory.createValidateSession(),
    cleanupSession: factory.createSessionCleanup(),
    cleanupAllUserSessions: factory.createSessionCleanup({ expireAllUserSessions: true }),
    
    // Rate limiting
    rateLimit: (maxRequests, windowMs) => factory.createRateLimit(maxRequests, windowMs)
  };
}

/**
 * Get session service statistics
 * @param {Object} services - Initialized services
 * @returns {Promise<Object>} Combined statistics
 */
async function getSessionStats(services) {
  try {
    const [sessionStats, cleanupMetrics, cacheMetrics] = await Promise.all([
      services.sessionService.getSessionStats(),
      services.cleanupService.getMetrics(),
      Promise.resolve(services.cacheManager.getMetrics())
    ]);

    return {
      session: sessionStats,
      cleanup: cleanupMetrics,
      cache: cacheMetrics,
      registry: services.registry.getServiceStates(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to get session statistics:', error);
    return null;
  }
}

/**
 * Gracefully shutdown session services
 * @param {Object} services - Initialized services
 */
async function shutdownSessionServices(services) {
  try {
    console.log('🔄 Shutting down Session Management System...');
    
    // Stop cleanup service first
    if (services.cleanupService) {
      await services.cleanupService.stop();
    }
    
    // Shutdown session service
    if (services.sessionService) {
      await services.sessionService.shutdown();
    }
    
    // Shutdown registry (will handle remaining services)
    if (services.registry) {
      await services.registry.shutdown();
    }
    
    console.log('✅ Session Management System shutdown complete');
  } catch (error) {
    console.error('❌ Error during session services shutdown:', error);
  }
}

module.exports = {
  bootstrapSessionServices,
  getSessionMiddleware,
  getSessionStats,
  shutdownSessionServices,
  serviceRegistry
};
