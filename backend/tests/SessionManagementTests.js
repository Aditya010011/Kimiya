/**
 * Comprehensive Test Suite for Session Management System
 * 
 * Tests all components of the new session management architecture:
 * - Service Registry
 * - Session Repository
 * - Session Cache Manager
 * - Session Service
 * - Session Cleanup Service
 * - Session Middleware Factory
 * - Integration tests
 */

const assert = require('assert');
const { performance } = require('perf_hooks');

class SessionManagementTests {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    this.testSuites = [
      'testServiceRegistry',
      'testSessionRepository',
      'testSessionCacheManager',
      'testSessionService',
      'testSessionCleanupService',
      'testSessionMiddlewareFactory',
      'testIntegration',
      'testPerformance',
      'testSecurity'
    ];
    
    console.log('🧪 Session Management Test Suite initialized');
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting comprehensive session management tests...');
    const startTime = performance.now();
    
    for (const testSuite of this.testSuites) {
      try {
        console.log(`\n📋 Running ${testSuite}...`);
        await this[testSuite]();
        console.log(`✅ ${testSuite} completed`);
      } catch (error) {
        console.error(`❌ ${testSuite} failed:`, error.message);
        this.testResults.errors.push({ suite: testSuite, error: error.message });
      }
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    this.printTestResults(duration);
    return this.testResults;
  }

  /**
   * Test Service Registry
   */
  async testServiceRegistry() {
    const ServiceRegistry = require('../core/ServiceRegistry');
    const registry = new ServiceRegistry();
    
    // Test service registration
    registry.register('testService', () => ({ test: true }), {
      singleton: true,
      priority: 10
    });
    
    assert(registry.has('testService'), 'Service should be registered');
    assert.strictEqual(registry.getState('testService'), 'registered', 'Service state should be registered');
    
    // Test service initialization
    const service = await registry.get('testService');
    assert(service && service.test === true, 'Service should be initialized correctly');
    assert(registry.isInitialized('testService'), 'Service should be marked as initialized');
    
    // Test dependency injection
    registry.register('dependentService', (deps) => ({
      dependency: deps.testService
    }), {
      dependencies: ['testService']
    });
    
    const dependentService = await registry.get('dependentService');
    assert(dependentService.dependency && dependentService.dependency.test === true, 
           'Dependency injection should work');
    
    // Test health check
    const healthResults = await registry.healthCheck();
    assert(healthResults.testService, 'Health check should return results');
    
    await registry.shutdown();
    this.testResults.passed += 5;
  }

  /**
   * Test Session Repository
   */
  async testSessionRepository() {
    const SessionRepository = require('../repositories/SessionRepository');
    const databaseService = require('../services/database');
    
    const repository = new SessionRepository(databaseService);
    
    // Test session creation
    const sessionData = {
      userId: 1,
      sessionToken: 'test_token_' + Date.now(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent'
    };
    
    const createdSession = await repository.createSession(sessionData);
    assert(createdSession && createdSession.session_token === sessionData.sessionToken,
           'Session should be created correctly');
    
    // Test session retrieval
    const retrievedSession = await repository.getSessionByToken(sessionData.sessionToken);
    assert(retrievedSession && retrievedSession.user_id === sessionData.userId,
           'Session should be retrieved correctly');
    
    // Test heartbeat update
    const heartbeatSuccess = await repository.updateLastAccessed(sessionData.sessionToken, sessionData.userId);
    assert(heartbeatSuccess, 'Heartbeat update should succeed');
    
    // Test session expiration
    const expireSuccess = await repository.expireSession(sessionData.sessionToken, 'test');
    assert(expireSuccess, 'Session expiration should succeed');
    
    // Test statistics
    const stats = await repository.getSessionStats();
    assert(stats && typeof stats.total_sessions === 'number', 'Statistics should be returned');
    
    this.testResults.passed += 5;
  }

  /**
   * Test Session Cache Manager
   */
  async testSessionCacheManager() {
    const SessionCacheManager = require('../services/SessionCacheManager');
    
    const cacheManager = new SessionCacheManager({
      maxMemorySize: 100,
      ttl: 60000,
      enableRedis: false
    });
    
    await cacheManager.initialize();
    
    // Test cache set/get
    const testData = { userId: 1, sessionToken: 'test_cache_token' };
    await cacheManager.set('test_cache_token', testData);
    
    const retrievedData = await cacheManager.get('test_cache_token');
    assert(retrievedData && retrievedData.userId === testData.userId,
           'Cache should store and retrieve data correctly');
    
    // Test cache has
    assert(cacheManager.has('test_cache_token'), 'Cache should report having the key');
    
    // Test cache delete
    await cacheManager.delete('test_cache_token');
    const deletedData = await cacheManager.get('test_cache_token');
    assert(deletedData === null, 'Cache should return null for deleted keys');
    
    // Test cache metrics
    const metrics = cacheManager.getMetrics();
    assert(metrics && typeof metrics.hits === 'number', 'Metrics should be available');
    
    // Test cache cleanup
    cacheManager.cleanup();
    
    await cacheManager.shutdown();
    this.testResults.passed += 6;
  }

  /**
   * Test Session Service
   */
  async testSessionService() {
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 100, enableRedis: false },
      session: { maxSessionsPerUser: 5 }
    });
    
    // Test session creation
    const sessionData = {
      userId: 1,
      sessionToken: 'test_service_token_' + Date.now(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Test Service Agent'
    };
    
    const createdSession = await services.sessionService.createSession(sessionData);
    assert(createdSession && createdSession.session_token === sessionData.sessionToken,
           'Session service should create sessions');
    
    // Test session retrieval
    const retrievedSession = await services.sessionService.getSession(sessionData.sessionToken);
    assert(retrievedSession && retrievedSession.userId === sessionData.userId,
           'Session service should retrieve sessions');
    
    // Test heartbeat
    const heartbeatSuccess = await services.sessionService.recordHeartbeat(
      sessionData.sessionToken, sessionData.userId
    );
    assert(heartbeatSuccess, 'Session service should record heartbeats');
    
    // Test session expiration
    const expireSuccess = await services.sessionService.expireSession(
      sessionData.sessionToken, 'test'
    );
    assert(expireSuccess, 'Session service should expire sessions');
    
    // Test statistics
    const stats = await services.sessionService.getSessionStats();
    assert(stats && stats.database, 'Session service should provide statistics');
    
    // Cleanup
    await services.cleanupService.stop();
    await services.sessionService.shutdown();
    
    this.testResults.passed += 5;
  }

  /**
   * Test Session Cleanup Service
   */
  async testSessionCleanupService() {
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 100, enableRedis: false },
      cleanup: { expiredSessionsInterval: 1000 }
    });
    
    // Test cleanup service start/stop
    assert(services.cleanupService.isRunning, 'Cleanup service should be running');
    
    // Test metrics
    const metrics = services.cleanupService.getMetrics();
    assert(metrics && typeof metrics.totalCleanups === 'number',
           'Cleanup service should provide metrics');
    
    // Test force cleanup
    await services.cleanupService.forceCleanup();
    
    // Test cleanup service stop
    await services.cleanupService.stop();
    assert(!services.cleanupService.isRunning, 'Cleanup service should be stopped');
    
    // Cleanup
    await services.sessionService.shutdown();
    
    this.testResults.passed += 4;
  }

  /**
   * Test Session Middleware Factory
   */
  async testSessionMiddlewareFactory() {
    const { bootstrapSessionServices, getSessionMiddleware } = require('../core/SessionServiceBootstrap');
    
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 100, enableRedis: false }
    });
    
    const middleware = getSessionMiddleware(services);
    
    // Test middleware creation
    assert(typeof middleware.authenticateToken === 'function',
           'Should create authenticateToken middleware');
    assert(typeof middleware.requireAdmin === 'function',
           'Should create requireAdmin middleware');
    assert(typeof middleware.validateSession === 'function',
           'Should create validateSession middleware');
    assert(typeof middleware.rateLimit === 'function',
           'Should create rateLimit middleware');
    
    // Test middleware factory methods
    const factory = services.middlewareFactory;
    const customAuth = factory.createAuthenticateToken({ enableHeartbeat: false });
    assert(typeof customAuth === 'function', 'Should create custom middleware');
    
    const roleMiddleware = factory.createRequireRole(['admin', 'user']);
    assert(typeof roleMiddleware === 'function', 'Should create role middleware');
    
    // Cleanup
    await services.cleanupService.stop();
    await services.sessionService.shutdown();
    
    this.testResults.passed += 6;
  }

  /**
   * Test Integration
   */
  async testIntegration() {
    const { bootstrapSessionServices, getSessionMiddleware, getSessionStats } = 
          require('../core/SessionServiceBootstrap');
    
    // Test full system bootstrap
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 100, enableRedis: false }
    });
    
    assert(services.sessionService && services.sessionService.isInitialized,
           'Session service should be initialized');
    assert(services.cleanupService && services.cleanupService.isRunning,
           'Cleanup service should be running');
    
    // Test middleware integration
    const middleware = getSessionMiddleware(services);
    assert(middleware && typeof middleware.authenticateToken === 'function',
           'Middleware should be available');
    
    // Test statistics integration
    const stats = await getSessionStats(services);
    assert(stats && stats.session && stats.cache && stats.cleanup,
           'Integrated statistics should be available');
    
    // Test end-to-end session flow
    const sessionToken = 'integration_test_' + Date.now();
    const sessionData = {
      userId: 1,
      sessionToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Integration Test'
    };
    
    // Create session
    await services.sessionService.createSession(sessionData);
    
    // Verify in cache
    const cachedSession = await services.cacheManager.get(sessionToken);
    assert(cachedSession && cachedSession.userId === 1,
           'Session should be in cache after creation');
    
    // Record heartbeat
    const heartbeatSuccess = await services.sessionService.recordHeartbeat(sessionToken, 1);
    assert(heartbeatSuccess, 'Heartbeat should be recorded');
    
    // Expire session
    const expireSuccess = await services.sessionService.expireSession(sessionToken, 'test');
    assert(expireSuccess, 'Session should be expired');
    
    // Verify not in cache
    const expiredSession = await services.cacheManager.get(sessionToken);
    assert(expiredSession === null, 'Expired session should not be in cache');
    
    // Cleanup
    await services.cleanupService.stop();
    await services.sessionService.shutdown();
    
    this.testResults.passed += 8;
  }

  /**
   * Test Performance
   */
  async testPerformance() {
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 1000, enableRedis: false }
    });
    
    const iterations = 100;
    const sessionTokens = [];
    
    // Test session creation performance
    const createStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const sessionToken = `perf_test_${i}_${Date.now()}`;
      sessionTokens.push(sessionToken);
      
      await services.sessionService.createSession({
        userId: 1,
        sessionToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'Performance Test'
      });
    }
    const createEnd = performance.now();
    const createTime = createEnd - createStart;
    
    console.log(`📊 Created ${iterations} sessions in ${Math.round(createTime)}ms (${Math.round(createTime/iterations)}ms per session)`);
    assert(createTime < iterations * 50, 'Session creation should be performant'); // Less than 50ms per session
    
    // Test session retrieval performance
    const retrieveStart = performance.now();
    for (const sessionToken of sessionTokens) {
      const session = await services.sessionService.getSession(sessionToken);
      assert(session !== null, 'Session should be retrievable');
    }
    const retrieveEnd = performance.now();
    const retrieveTime = retrieveEnd - retrieveStart;
    
    console.log(`📊 Retrieved ${iterations} sessions in ${Math.round(retrieveTime)}ms (${Math.round(retrieveTime/iterations)}ms per session)`);
    assert(retrieveTime < iterations * 10, 'Session retrieval should be performant'); // Less than 10ms per session
    
    // Test cache performance
    const cacheMetrics = services.cacheManager.getMetrics();
    const hitRate = parseFloat(cacheMetrics.hitRate);
    console.log(`📊 Cache hit rate: ${cacheMetrics.hitRate}`);
    assert(hitRate > 80, 'Cache hit rate should be high'); // At least 80%
    
    // Cleanup
    await services.cleanupService.stop();
    await services.sessionService.shutdown();
    
    this.testResults.passed += 4;
  }

  /**
   * Test Security
   */
  async testSecurity() {
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    
    const services = await bootstrapSessionServices({
      cache: { maxMemorySize: 100, enableRedis: false },
      session: { maxSessionsPerUser: 2 }
    });
    
    // Test session limit enforcement
    const userId = 999;
    const sessionTokens = [];
    
    // Create sessions up to limit
    for (let i = 0; i < 3; i++) {
      const sessionToken = `security_test_${i}_${Date.now()}`;
      sessionTokens.push(sessionToken);
      
      await services.sessionService.createSession({
        userId,
        sessionToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'Security Test'
      });
    }
    
    // Verify session limit was enforced (oldest should be expired)
    const userSessions = await services.sessionService.getUserSessions(userId);
    assert(userSessions.length <= 2, 'Session limit should be enforced');
    
    // Test session isolation (user can't access other user's sessions)
    const otherUserToken = 'other_user_' + Date.now();
    await services.sessionService.createSession({
      userId: 888,
      sessionToken: otherUserToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Other User'
    });
    
    // User 999 shouldn't be able to record heartbeat for user 888's session
    const invalidHeartbeat = await services.sessionService.recordHeartbeat(otherUserToken, userId);
    assert(!invalidHeartbeat, 'Users should not be able to access other users\' sessions');
    
    // Test session expiration
    const expiredToken = sessionTokens[0];
    await services.sessionService.expireSession(expiredToken, 'security_test');
    
    const expiredSession = await services.sessionService.getSession(expiredToken);
    assert(expiredSession === null, 'Expired sessions should not be accessible');
    
    // Cleanup
    await services.cleanupService.stop();
    await services.sessionService.shutdown();
    
    this.testResults.passed += 4;
  }

  /**
   * Print test results
   */
  printTestResults(duration) {
    console.log('\n🧪 Test Results Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`⏭️  Skipped: ${this.testResults.skipped}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.testResults.errors.forEach(error => {
        console.log(`   • ${error.suite}: ${error.error}`);
      });
    }
    
    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    const successRate = total > 0 ? Math.round((this.testResults.passed / total) * 100) : 0;
    
    console.log(`\n📊 Success Rate: ${successRate}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (successRate === 100) {
      console.log('🎉 All tests passed! Session Management System is ready for deployment.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    }
  }
}

// CLI interface for running tests
if (require.main === module) {
  const tests = new SessionManagementTests();
  
  tests.runAllTests()
    .then((results) => {
      const success = results.failed === 0 && results.errors.length === 0;
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = SessionManagementTests;
