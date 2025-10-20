const sql = require('mssql');

/**
 * Database Service for MSSQL Connection
 * Handles connection pooling and query execution
 */
class DatabaseService {
  constructor() {
    this.pool = null;

    // Validate required environment variables
    const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required database environment variables: ${missingVars.join(', ')}`);
    }

    this.config = {
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT) || 1433,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true' || true, // Use encryption for Azure
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
        enableArithAbort: true,
        requestTimeout: 30000, // 30 seconds
        connectionTimeout: 30000, // 30 seconds
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }

  /**
   * Initialize database connection pool
   */
  async connect() {
    try {
      if (this.pool) {
        console.log('🔄 Database pool already exists, reusing connection');
        return this.pool;
      }

      console.log('🔌 Connecting to MSSQL database...');
      console.log(`📍 Server: ${this.config.server}`);
      console.log(`📊 Database: ${this.config.database}`);
      console.log(`👤 User: ${this.config.user}`);

      this.pool = await sql.connect(this.config);
      
      console.log('✅ Database connected successfully');
      
      // Test the connection
      await this.testConnection();
      
      return this.pool;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.pool.request().query('SELECT 1 as test');
      console.log('🧪 Database connection test successful');
      return result;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      throw error;
    }
  }

  /**
   * Get database connection pool
   * Ensures connection is established before returning pool
   */
  async getPool() {
    if (!this.pool) {
      await this.connect();
    }
    return this.pool;
  }

  /**
   * Execute a query with parameters
   */
  async query(queryString, parameters = {}) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = this.pool.request();
      
      // Add parameters to the request
      Object.keys(parameters).forEach(key => {
        request.input(key, parameters[key]);
      });

      const result = await request.query(queryString);
      return result;
    } catch (error) {
      console.error('❌ Database query failed:', error.message);
      console.error('Query:', queryString);
      console.error('Parameters:', parameters);
      throw error;
    }
  }

  /**
   * Execute a stored procedure
   */
  async executeStoredProcedure(procedureName, parameters = {}) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = this.pool.request();
      
      // Add parameters to the request
      Object.keys(parameters).forEach(key => {
        request.input(key, parameters[key]);
      });

      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      console.error('❌ Stored procedure execution failed:', error.message);
      console.error('Procedure:', procedureName);
      console.error('Parameters:', parameters);
      throw error;
    }
  }

  /**
   * Begin a transaction with specified isolation level
   * @param {string} isolationLevel - Isolation level (default: SERIALIZABLE for credit operations)
   */
  async beginTransaction(isolationLevel = sql.ISOLATION_LEVEL.SERIALIZABLE) {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const transaction = new sql.Transaction(this.pool);
      await transaction.begin(isolationLevel);
      return transaction;
    } catch (error) {
      console.error('❌ Failed to begin transaction:', error.message);
      throw error;
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(transaction) {
    try {
      if (transaction) {
        await transaction.commit();
      }
    } catch (error) {
      console.error('❌ Failed to commit transaction:', error.message);
      throw error;
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transaction) {
    try {
      if (transaction) {
        await transaction.rollback();
      }
    } catch (error) {
      console.error('❌ Failed to rollback transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      const startTime = Date.now();
      await this.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        server: this.config.server,
        database: this.config.database,
        connected: !!this.pool,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        server: this.config.server,
        database: this.config.database,
        connected: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        console.log('🔌 Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing database connection:', error.message);
    }
  }

  /**
   * Get connection info (without sensitive data)
   */
  getConnectionInfo() {
    return {
      server: this.config.server,
      database: this.config.database,
      user: this.config.user,
      port: this.config.port,
      encrypt: this.config.options.encrypt,
      connected: !!this.pool
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.query(`
        UPDATE tblUserSessions
        SET is_active = 0, last_accessed_at = GETDATE()
        WHERE is_active = 1 AND expires_at <= GETDATE()
      `);

      if (result.rowsAffected[0] > 0) {
        console.log(`🧹 Cleaned up ${result.rowsAffected[0]} expired sessions`);
      }

      return result.rowsAffected[0];
    } catch (error) {
      console.error('❌ Failed to cleanup expired sessions:', error.message);
      return 0;
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down database connection...');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down database connection...');
  await databaseService.close();
  process.exit(0);
});

module.exports = databaseService;
