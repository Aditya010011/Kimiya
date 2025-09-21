/**
 * Session Cache Manager
 * 
 * Provides high-performance session caching with multiple storage backends:
 * - In-memory cache (primary)
 * - Redis cache (fallback/distributed)
 * - Database (persistent storage)
 * 
 * Key Features:
 * - Multi-tier caching strategy
 * - Automatic cache invalidation
 * - Memory management and cleanup
 * - Redis fallback for scalability
 * - Cache warming and preloading
 * - Performance metrics
 */
class SessionCacheManager {
  constructor(options = {}) {
    this.options = {
      maxMemorySize: options.maxMemorySize || 10000, // Max sessions in memory
      ttl: options.ttl || 30 * 60 * 1000, // 30 minutes default TTL
      cleanupInterval: options.cleanupInterval || 5 * 60 * 1000, // 5 minutes
      enableRedis: options.enableRedis || false,
      redisConfig: options.redisConfig || {},
      enableMetrics: options.enableMetrics !== false,
      ...options
    };

    // In-memory cache
    this.memoryCache = new Map();
    this.cacheMetadata = new Map(); // Store TTL and access times
    
    // Redis client (optional)
    this.redisClient = null;
    this.redisAvailable = false;
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryHits: 0,
      redisHits: 0,
      errors: 0
    };

    // Cleanup interval
    this.cleanupInterval = null;


  }

  /**
   * Initialize the cache manager
   */
  async initialize() {
    try {
      // Initialize Redis if enabled
      if (this.options.enableRedis) {
        await this.initializeRedis();
      }

      // Start cleanup interval
      this.startCleanupInterval();


    } catch (error) {
      console.error('❌ Failed to initialize Session Cache Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      // Only initialize Redis if explicitly configured
      if (!this.options.redisConfig.host) {
        console.log('📝 Redis not configured, using memory-only cache');
        return;
      }

      const redis = require('redis');
      this.redisClient = redis.createClient(this.options.redisConfig);
      
      this.redisClient.on('error', (error) => {
        console.warn('⚠️  Redis connection error:', error.message);
        this.redisAvailable = false;
        this.metrics.errors++;
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Redis connected for session caching');
        this.redisAvailable = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      console.warn('⚠️  Redis initialization failed, using memory-only cache:', error.message);
      this.redisAvailable = false;
    }
  }

  /**
   * Get session from cache
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object|null>} Session data or null
   */
  async get(sessionToken) {
    try {
      // Try memory cache first
      if (this.memoryCache.has(sessionToken)) {
        const sessionData = this.memoryCache.get(sessionToken);
        const metadata = this.cacheMetadata.get(sessionToken);
        
        // Check if expired
        if (metadata && Date.now() > metadata.expiresAt) {
          this.delete(sessionToken);
          this.metrics.misses++;
          return null;
        }

        // Update access time
        if (metadata) {
          metadata.lastAccessed = Date.now();
        }

        this.metrics.hits++;
        this.metrics.memoryHits++;
        return sessionData;
      }

      // Try Redis cache if available
      if (this.redisAvailable && this.redisClient) {
        try {
          const redisData = await this.redisClient.get(`session:${sessionToken}`);
          if (redisData) {
            const sessionData = JSON.parse(redisData);
            
            // Store in memory cache for faster access
            this.setMemoryCache(sessionToken, sessionData);
            
            this.metrics.hits++;
            this.metrics.redisHits++;
            return sessionData;
          }
        } catch (redisError) {
          console.warn('⚠️  Redis get error:', redisError.message);
          this.metrics.errors++;
        }
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Set session in cache
   * @param {string} sessionToken - Session token
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(sessionToken, sessionData, ttl = null) {
    try {
      const actualTtl = ttl || this.options.ttl;
      
      // Set in memory cache
      this.setMemoryCache(sessionToken, sessionData, actualTtl);
      
      // Set in Redis if available
      if (this.redisAvailable && this.redisClient) {
        try {
          const redisKey = `session:${sessionToken}`;
          const redisValue = JSON.stringify(sessionData);
          const redisTtlSeconds = Math.ceil(actualTtl / 1000);
          
          await this.redisClient.setEx(redisKey, redisTtlSeconds, redisValue);
        } catch (redisError) {
          console.warn('⚠️  Redis set error:', redisError.message);
          this.metrics.errors++;
        }
      }

      this.metrics.sets++;
    } catch (error) {
      console.error('❌ Cache set error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Set session in memory cache
   * @param {string} sessionToken - Session token
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in milliseconds
   */
  setMemoryCache(sessionToken, sessionData, ttl = null) {
    const actualTtl = ttl || this.options.ttl;
    
    // Check memory limit and evict if necessary
    if (this.memoryCache.size >= this.options.maxMemorySize) {
      this.evictLeastRecentlyUsed();
    }

    this.memoryCache.set(sessionToken, sessionData);
    this.cacheMetadata.set(sessionToken, {
      expiresAt: Date.now() + actualTtl,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    });
  }

  /**
   * Delete session from cache
   * @param {string} sessionToken - Session token
   */
  async delete(sessionToken) {
    try {
      // Delete from memory
      this.memoryCache.delete(sessionToken);
      this.cacheMetadata.delete(sessionToken);

      // Delete from Redis if available
      if (this.redisAvailable && this.redisClient) {
        try {
          await this.redisClient.del(`session:${sessionToken}`);
        } catch (redisError) {
          console.warn('⚠️  Redis delete error:', redisError.message);
          this.metrics.errors++;
        }
      }

      this.metrics.deletes++;
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Delete all sessions for a user
   * @param {number} userId - User ID
   */
  async deleteUserSessions(userId) {
    try {
      let deletedCount = 0;

      // Delete from memory cache
      for (const [sessionToken, sessionData] of this.memoryCache.entries()) {
        if (sessionData.userId === userId) {
          this.memoryCache.delete(sessionToken);
          this.cacheMetadata.delete(sessionToken);
          deletedCount++;
        }
      }

      // Delete from Redis if available
      if (this.redisAvailable && this.redisClient) {
        try {
          // This is a simplified approach - in production, you might want to
          // maintain a user-to-sessions mapping for more efficient deletion
          const keys = await this.redisClient.keys('session:*');
          for (const key of keys) {
            const data = await this.redisClient.get(key);
            if (data) {
              const sessionData = JSON.parse(data);
              if (sessionData.userId === userId) {
                await this.redisClient.del(key);
                deletedCount++;
              }
            }
          }
        } catch (redisError) {
          console.warn('⚠️  Redis user session deletion error:', redisError.message);
          this.metrics.errors++;
        }
      }

      this.metrics.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      console.error('❌ Cache user session deletion error:', error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * Check if session exists in cache
   * @param {string} sessionToken - Session token
   * @returns {boolean}
   */
  has(sessionToken) {
    return this.memoryCache.has(sessionToken);
  }

  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.memoryCache.size;
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.cacheMetadata.clear();

      // Clear Redis if available
      if (this.redisAvailable && this.redisClient) {
        try {
          const keys = await this.redisClient.keys('session:*');
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        } catch (redisError) {
          console.warn('⚠️  Redis clear error:', redisError.message);
          this.metrics.errors++;
        }
      }

      console.log('🧹 Session cache cleared');
    } catch (error) {
      console.error('❌ Cache clear error:', error);
      this.metrics.errors++;
    }
  }

  /**
   * Evict least recently used sessions
   */
  evictLeastRecentlyUsed() {
    const entries = Array.from(this.cacheMetadata.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    const evictCount = Math.ceil(this.options.maxMemorySize * 0.1); // Evict 10%
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [sessionToken] = entries[i];
      this.memoryCache.delete(sessionToken);
      this.cacheMetadata.delete(sessionToken);
      this.metrics.evictions++;
    }


  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);

    console.log(`🧹 Started cache cleanup interval (every ${this.options.cleanupInterval / 1000}s)`);
  }

  /**
   * Cleanup expired sessions
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionToken, metadata] of this.cacheMetadata.entries()) {
      if (now > metadata.expiresAt) {
        this.memoryCache.delete(sessionToken);
        this.cacheMetadata.delete(sessionToken);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions from cache`);
    }
  }

  /**
   * Get cache metrics
   * @returns {Object}
   */
  getMetrics() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0 
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      memorySize: this.memoryCache.size,
      maxMemorySize: this.options.maxMemorySize,
      redisAvailable: this.redisAvailable
    };
  }

  /**
   * Shutdown the cache manager
   */
  async shutdown() {
    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
      }

      // Clear memory cache
      this.memoryCache.clear();
      this.cacheMetadata.clear();

      console.log('🔒 Session Cache Manager shutdown complete');
    } catch (error) {
      console.error('❌ Error shutting down Session Cache Manager:', error);
    }
  }
}

module.exports = SessionCacheManager;
