const EventEmitter = require('events');

/**
 * Service Registry and Dependency Injection Container
 * 
 * This class manages service lifecycle and dependencies without circular imports.
 * It uses a registry pattern with lazy initialization and event-driven communication.
 * 
 * Key Features:
 * - Eliminates circular dependencies through lazy loading
 * - Centralized service management
 * - Event-driven service communication
 * - Graceful service initialization and shutdown
 * - Service health monitoring
 */
class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.serviceFactories = new Map();
    this.serviceStates = new Map();
    this.initializationOrder = [];
    this.isShuttingDown = false;
    
    // Service states
    this.STATES = {
      REGISTERED: 'registered',
      INITIALIZING: 'initializing', 
      INITIALIZED: 'initialized',
      FAILED: 'failed',
      SHUTTING_DOWN: 'shutting_down',
      SHUTDOWN: 'shutdown'
    };

    console.log('🏗️  Service Registry initialized');
  }

  /**
   * Register a service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that creates the service
   * @param {Object} options - Service options
   */
  register(name, factory, options = {}) {
    if (this.serviceFactories.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    const serviceConfig = {
      factory,
      dependencies: options.dependencies || [],
      singleton: options.singleton !== false, // Default to singleton
      lazy: options.lazy !== false, // Default to lazy loading
      priority: options.priority || 0, // Higher priority = earlier initialization
      healthCheck: options.healthCheck || null,
      ...options
    };

    this.serviceFactories.set(name, serviceConfig);
    this.serviceStates.set(name, this.STATES.REGISTERED);
    
    console.log(`📝 Service '${name}' registered`);
    this.emit('service:registered', { name, config: serviceConfig });
    
    return this;
  }

  /**
   * Get a service instance (lazy initialization)
   * @param {string} name - Service name
   * @returns {Promise<any>} Service instance
   */
  async get(name) {
    if (this.isShuttingDown) {
      throw new Error(`Cannot get service '${name}' during shutdown`);
    }

    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    // Initialize service if not yet initialized
    return await this.initialize(name);
  }

  /**
   * Initialize a specific service
   * @param {string} name - Service name
   * @returns {Promise<any>} Service instance
   */
  async initialize(name) {
    const config = this.serviceFactories.get(name);
    if (!config) {
      throw new Error(`Service '${name}' is not registered`);
    }

    const currentState = this.serviceStates.get(name);
    
    // Return existing instance if already initialized
    if (currentState === this.STATES.INITIALIZED && this.services.has(name)) {
      return this.services.get(name);
    }

    // Prevent concurrent initialization
    if (currentState === this.STATES.INITIALIZING) {
      return new Promise((resolve, reject) => {
        const onInitialized = (event) => {
          if (event.name === name) {
            this.removeListener('service:initialized', onInitialized);
            this.removeListener('service:failed', onFailed);
            resolve(this.services.get(name));
          }
        };
        
        const onFailed = (event) => {
          if (event.name === name) {
            this.removeListener('service:initialized', onInitialized);
            this.removeListener('service:failed', onFailed);
            reject(event.error);
          }
        };

        this.on('service:initialized', onInitialized);
        this.on('service:failed', onFailed);
      });
    }

    try {
      this.serviceStates.set(name, this.STATES.INITIALIZING);
      console.log(`🔄 Initializing service '${name}'...`);
      
      // Initialize dependencies first
      const dependencies = {};
      for (const depName of config.dependencies) {
        dependencies[depName] = await this.get(depName);
      }

      // Create service instance
      const serviceInstance = await config.factory(dependencies, this);
      
      // Store instance if singleton
      if (config.singleton) {
        this.services.set(name, serviceInstance);
      }

      this.serviceStates.set(name, this.STATES.INITIALIZED);
      this.initializationOrder.push(name);
      
      console.log(`✅ Service '${name}' initialized successfully`);
      this.emit('service:initialized', { name, instance: serviceInstance });
      
      return serviceInstance;
      
    } catch (error) {
      this.serviceStates.set(name, this.STATES.FAILED);
      console.error(`❌ Failed to initialize service '${name}':`, error);
      this.emit('service:failed', { name, error });
      throw error;
    }
  }

  /**
   * Initialize all registered services
   * @returns {Promise<void>}
   */
  async initializeAll() {
    console.log('🚀 Initializing all services...');
    
    // Sort services by priority (higher priority first)
    const sortedServices = Array.from(this.serviceFactories.entries())
      .sort(([, a], [, b]) => b.priority - a.priority);

    const results = [];
    for (const [name] of sortedServices) {
      try {
        await this.initialize(name);
        results.push({ name, status: 'success' });
      } catch (error) {
        results.push({ name, status: 'failed', error: error.message });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`🎯 Service initialization complete: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      console.warn('⚠️  Some services failed to initialize:', 
        results.filter(r => r.status === 'failed'));
    }

    this.emit('registry:initialized', { results });
    return results;
  }

  /**
   * Check if a service is available
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.serviceFactories.has(name);
  }

  /**
   * Check if a service is initialized
   * @param {string} name - Service name
   * @returns {boolean}
   */
  isInitialized(name) {
    return this.serviceStates.get(name) === this.STATES.INITIALIZED;
  }

  /**
   * Get service state
   * @param {string} name - Service name
   * @returns {string}
   */
  getState(name) {
    return this.serviceStates.get(name) || 'unknown';
  }

  /**
   * Get all service states
   * @returns {Object}
   */
  getServiceStates() {
    const states = {};
    for (const [name, state] of this.serviceStates.entries()) {
      states[name] = state;
    }
    return states;
  }

  /**
   * Perform health checks on all services
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, config] of this.serviceFactories.entries()) {
      if (config.healthCheck && this.isInitialized(name)) {
        try {
          const service = this.services.get(name);
          const isHealthy = await config.healthCheck(service);
          results[name] = { status: isHealthy ? 'healthy' : 'unhealthy' };
        } catch (error) {
          results[name] = { status: 'error', error: error.message };
        }
      } else {
        results[name] = { status: this.getState(name) };
      }
    }
    
    return results;
  }

  /**
   * Gracefully shutdown all services
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Shutting down Service Registry...');
    
    // Shutdown services in reverse initialization order
    const shutdownOrder = [...this.initializationOrder].reverse();
    
    for (const name of shutdownOrder) {
      try {
        this.serviceStates.set(name, this.STATES.SHUTTING_DOWN);
        
        const service = this.services.get(name);
        if (service && typeof service.shutdown === 'function') {
          await service.shutdown();
        }
        
        this.services.delete(name);
        this.serviceStates.set(name, this.STATES.SHUTDOWN);
        console.log(`🔒 Service '${name}' shutdown complete`);
        
      } catch (error) {
        console.error(`❌ Error shutting down service '${name}':`, error);
      }
    }

    this.emit('registry:shutdown');
    console.log('✅ Service Registry shutdown complete');
  }
}

// Create singleton instance
const serviceRegistry = new ServiceRegistry();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, shutting down services...');
  await serviceRegistry.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, shutting down services...');
  await serviceRegistry.shutdown();
  process.exit(0);
});

module.exports = serviceRegistry;
