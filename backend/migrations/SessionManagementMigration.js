/**
 * Session Management Migration Script
 * 
 * Migrates from the old SessionManager to the new robust session management architecture.
 * This script handles the transition safely with rollback capabilities.
 * 
 * Migration Steps:
 * 1. Backup existing session data
 * 2. Validate new system components
 * 3. Migrate active sessions
 * 4. Update database schema if needed
 * 5. Verify migration success
 * 6. Cleanup old system components
 */

const fs = require('fs').promises;
const path = require('path');

class SessionManagementMigration {
  constructor() {
    this.migrationId = `session_mgmt_${Date.now()}`;
    this.backupPath = path.join(__dirname, '../backups', this.migrationId);
    this.logPath = path.join(__dirname, '../logs', `migration_${this.migrationId}.log`);
    
    this.migrationSteps = [
      'validatePrerequisites',
      'backupExistingData',
      'validateNewSystem',
      'migrateActiveSessions',
      'updateDatabaseSchema',
      'verifyMigration',
      'cleanupOldSystem'
    ];
    
    this.rollbackSteps = [
      'restoreBackupData',
      'revertDatabaseSchema',
      'restoreOldSystem'
    ];
    
    this.migrationState = {
      currentStep: 0,
      completed: false,
      errors: [],
      startTime: null,
      endTime: null
    };
    
    console.log(`🔄 Session Management Migration initialized: ${this.migrationId}`);
  }

  /**
   * Run the complete migration
   */
  async migrate() {
    try {
      this.migrationState.startTime = new Date();
      await this.log('Starting session management migration...');
      
      // Create backup directory
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Execute migration steps
      for (let i = 0; i < this.migrationSteps.length; i++) {
        this.migrationState.currentStep = i;
        const stepName = this.migrationSteps[i];
        
        await this.log(`Executing step ${i + 1}/${this.migrationSteps.length}: ${stepName}`);
        console.log(`🔄 Migration Step ${i + 1}: ${stepName}`);
        
        try {
          await this[stepName]();
          await this.log(`✅ Step ${stepName} completed successfully`);
        } catch (error) {
          await this.log(`❌ Step ${stepName} failed: ${error.message}`);
          this.migrationState.errors.push({ step: stepName, error: error.message });
          throw error;
        }
      }
      
      this.migrationState.completed = true;
      this.migrationState.endTime = new Date();
      
      const duration = this.migrationState.endTime - this.migrationState.startTime;
      await this.log(`✅ Migration completed successfully in ${duration}ms`);
      console.log(`✅ Session Management Migration completed: ${this.migrationId}`);
      
      return {
        success: true,
        migrationId: this.migrationId,
        duration,
        steps: this.migrationSteps.length
      };
      
    } catch (error) {
      console.error(`❌ Migration failed: ${error.message}`);
      await this.log(`❌ Migration failed: ${error.message}`);
      
      // Attempt rollback
      console.log('🔄 Attempting rollback...');
      await this.rollback();
      
      throw error;
    }
  }

  /**
   * Step 1: Validate prerequisites
   */
  async validatePrerequisites() {
    // Check if database is accessible
    const databaseService = require('../services/database');
    await databaseService.testConnection();
    
    // Check if required tables exist
    const requiredTables = ['tblUsers', 'tblUserSessions', 'tblLogs'];
    for (const table of requiredTables) {
      const result = await databaseService.query(`
        SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = '${table}'
      `);
      
      if (result.recordset[0].count === 0) {
        throw new Error(`Required table ${table} does not exist`);
      }
    }
    
    // Check if new system files exist
    const requiredFiles = [
      '../core/ServiceRegistry.js',
      '../repositories/SessionRepository.js',
      '../services/SessionCacheManager.js',
      '../services/SessionService.js',
      '../services/SessionCleanupService.js',
      '../middleware/SessionMiddlewareFactory.js',
      '../core/SessionServiceBootstrap.js'
    ];
    
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(__dirname, file));
      } catch (error) {
        throw new Error(`Required file ${file} does not exist`);
      }
    }
    
    await this.log('Prerequisites validation completed');
  }

  /**
   * Step 2: Backup existing data
   */
  async backupExistingData() {
    const databaseService = require('../services/database');
    
    // Backup active sessions
    const activeSessions = await databaseService.query(`
      SELECT * FROM tblUserSessions WHERE is_active = 1
    `);
    
    await fs.writeFile(
      path.join(this.backupPath, 'active_sessions.json'),
      JSON.stringify(activeSessions.recordset, null, 2)
    );
    
    // Backup user data
    const users = await databaseService.query(`
      SELECT * FROM tblUsers WHERE is_active = 1
    `);
    
    await fs.writeFile(
      path.join(this.backupPath, 'users.json'),
      JSON.stringify(users.recordset, null, 2)
    );
    
    // Backup current server configuration
    const serverConfig = {
      sessionManagerEnabled: false, // Current state
      backupTime: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    };
    
    await fs.writeFile(
      path.join(this.backupPath, 'server_config.json'),
      JSON.stringify(serverConfig, null, 2)
    );
    
    await this.log(`Backup completed: ${activeSessions.recordset.length} sessions, ${users.recordset.length} users`);
  }

  /**
   * Step 3: Validate new system
   */
  async validateNewSystem() {
    // Test service registry
    const serviceRegistry = require('../core/ServiceRegistry');
    if (!serviceRegistry || typeof serviceRegistry.register !== 'function') {
      throw new Error('Service Registry is not properly initialized');
    }
    
    // Test session repository
    const SessionRepository = require('../repositories/SessionRepository');
    const databaseService = require('../services/database');
    const testRepo = new SessionRepository(databaseService);
    
    if (!testRepo || typeof testRepo.getSessionStats !== 'function') {
      throw new Error('Session Repository is not properly initialized');
    }
    
    // Test basic repository functionality
    const stats = await testRepo.getSessionStats();
    if (typeof stats.total_sessions === 'undefined') {
      throw new Error('Session Repository is not functioning correctly');
    }
    
    // Test cache manager
    const SessionCacheManager = require('../services/SessionCacheManager');
    const testCache = new SessionCacheManager({ maxMemorySize: 100 });
    
    if (!testCache || typeof testCache.get !== 'function') {
      throw new Error('Session Cache Manager is not properly initialized');
    }
    
    await this.log('New system validation completed');
  }

  /**
   * Step 4: Migrate active sessions
   */
  async migrateActiveSessions() {
    const databaseService = require('../services/database');
    
    // Get all active sessions
    const activeSessions = await databaseService.query(`
      SELECT * FROM tblUserSessions 
      WHERE is_active = 1 AND expires_at > GETDATE()
    `);
    
    await this.log(`Found ${activeSessions.recordset.length} active sessions to migrate`);
    
    // Initialize new session system temporarily for migration
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    const sessionServices = await bootstrapSessionServices({
      cache: { maxMemorySize: 1000, enableRedis: false }
    });
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // Migrate each session
    for (const session of activeSessions.recordset) {
      try {
        // The session already exists in the database, we just need to warm the cache
        const sessionData = {
          userId: session.user_id,
          sessionToken: session.session_token,
          expiresAt: new Date(session.expires_at),
          lastAccessed: new Date(session.last_accessed_at),
          lastHeartbeat: new Date(session.last_accessed_at),
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          deviceInfo: session.device_info ? JSON.parse(session.device_info) : null
        };
        
        // Add to cache
        await sessionServices.cacheManager.set(session.session_token, sessionData);
        migratedCount++;
        
      } catch (error) {
        console.warn(`Failed to migrate session ${session.session_token}:`, error.message);
        errorCount++;
      }
    }
    
    // Shutdown temporary services
    await sessionServices.cleanupService.stop();
    await sessionServices.sessionService.shutdown();
    
    await this.log(`Session migration completed: ${migratedCount} migrated, ${errorCount} errors`);
    
    if (errorCount > migratedCount * 0.1) { // More than 10% errors
      throw new Error(`Too many migration errors: ${errorCount}/${activeSessions.recordset.length}`);
    }
  }

  /**
   * Step 5: Update database schema
   */
  async updateDatabaseSchema() {
    const databaseService = require('../services/database');
    
    // Check if expiration_reason column exists
    const columnCheck = await databaseService.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblUserSessions' AND COLUMN_NAME = 'expiration_reason'
    `);
    
    if (columnCheck.recordset[0].count === 0) {
      // Add expiration_reason column
      await databaseService.query(`
        ALTER TABLE tblUserSessions 
        ADD expiration_reason VARCHAR(50) NULL
      `);
      
      await this.log('Added expiration_reason column to tblUserSessions');
    }
    
    // Check if device_info column exists
    const deviceInfoCheck = await databaseService.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblUserSessions' AND COLUMN_NAME = 'device_info'
    `);
    
    if (deviceInfoCheck.recordset[0].count === 0) {
      // Add device_info column
      await databaseService.query(`
        ALTER TABLE tblUserSessions 
        ADD device_info NVARCHAR(MAX) NULL
      `);
      
      await this.log('Added device_info column to tblUserSessions');
    }
    
    await this.log('Database schema update completed');
  }

  /**
   * Step 6: Verify migration
   */
  async verifyMigration() {
    // Test new system initialization
    const { bootstrapSessionServices } = require('../core/SessionServiceBootstrap');
    const sessionServices = await bootstrapSessionServices({
      cache: { maxMemorySize: 1000, enableRedis: false }
    });
    
    // Test basic functionality
    const stats = await sessionServices.sessionService.getSessionStats();
    if (!stats || !stats.database) {
      throw new Error('New session service is not functioning correctly');
    }
    
    // Test middleware creation
    const { getSessionMiddleware } = require('../core/SessionServiceBootstrap');
    const middleware = getSessionMiddleware(sessionServices);
    
    if (!middleware.authenticateToken || typeof middleware.authenticateToken !== 'function') {
      throw new Error('Session middleware is not functioning correctly');
    }
    
    // Cleanup test services
    await sessionServices.cleanupService.stop();
    await sessionServices.sessionService.shutdown();
    
    await this.log('Migration verification completed successfully');
  }

  /**
   * Step 7: Cleanup old system
   */
  async cleanupOldSystem() {
    // The old sessionManager is already disabled in server.js
    // This step is mainly for documentation and future cleanup
    
    await this.log('Old system cleanup completed (already disabled)');
  }

  /**
   * Rollback migration
   */
  async rollback() {
    try {
      await this.log('Starting migration rollback...');
      
      for (const stepName of this.rollbackSteps) {
        await this.log(`Executing rollback step: ${stepName}`);
        console.log(`🔄 Rollback Step: ${stepName}`);
        
        try {
          await this[stepName]();
          await this.log(`✅ Rollback step ${stepName} completed`);
        } catch (error) {
          await this.log(`❌ Rollback step ${stepName} failed: ${error.message}`);
          console.error(`❌ Rollback step ${stepName} failed:`, error);
        }
      }
      
      await this.log('Migration rollback completed');
      console.log('✅ Migration rollback completed');
      
    } catch (error) {
      await this.log(`❌ Rollback failed: ${error.message}`);
      console.error('❌ Rollback failed:', error);
    }
  }

  /**
   * Restore backup data
   */
  async restoreBackupData() {
    // In this case, we don't need to restore data since we didn't modify existing data
    // The migration mainly involved adding new functionality
    await this.log('Backup data restore completed (no data modification occurred)');
  }

  /**
   * Revert database schema
   */
  async revertDatabaseSchema() {
    // Remove added columns if they were added during migration
    const databaseService = require('../services/database');
    
    try {
      await databaseService.query(`
        ALTER TABLE tblUserSessions DROP COLUMN IF EXISTS expiration_reason
      `);
      
      await databaseService.query(`
        ALTER TABLE tblUserSessions DROP COLUMN IF EXISTS device_info
      `);
      
      await this.log('Database schema reverted');
    } catch (error) {
      await this.log(`Database schema revert failed: ${error.message}`);
    }
  }

  /**
   * Restore old system
   */
  async restoreOldSystem() {
    // The old system can be re-enabled by modifying server.js
    // This would require manual intervention
    await this.log('Old system restore requires manual server.js modification');
  }

  /**
   * Log migration events
   */
  async log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.appendFile(this.logPath, logEntry);
    } catch (error) {
      console.error('Failed to write to migration log:', error);
    }
  }

  /**
   * Get migration status
   */
  getStatus() {
    return {
      migrationId: this.migrationId,
      currentStep: this.migrationState.currentStep,
      totalSteps: this.migrationSteps.length,
      completed: this.migrationState.completed,
      errors: this.migrationState.errors,
      startTime: this.migrationState.startTime,
      endTime: this.migrationState.endTime
    };
  }
}

// CLI interface for running migration
if (require.main === module) {
  const migration = new SessionManagementMigration();

  migration.migrate()
    .then((result) => {
      console.log('🎉 Migration completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = SessionManagementMigration;
