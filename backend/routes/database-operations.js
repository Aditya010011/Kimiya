const express = require('express');
const databaseService = require('../services/database');

const router = express.Router();

/**
 * Test database connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const healthStatus = await databaseService.getHealthStatus();
    res.json({
      success: true,
      message: 'Database connection test completed',
      health: healthStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database connection test failed'
    });
  }
});

/**
 * Execute a simple query to test database functionality
 */
router.get('/test-query', async (req, res) => {
  try {
    // Simple test query
    const result = await databaseService.query(`
      SELECT
        GETDATE() as current_datetime,
        @@VERSION as sql_version,
        DB_NAME() as database_name,
        USER_NAME() as current_user_name
    `);

    res.json({
      success: true,
      message: 'Test query executed successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test query failed'
    });
  }
});

/**
 * Get database tables (for development/debugging)
 */
router.get('/tables', async (req, res) => {
  try {
    const result = await databaseService.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    res.json({
      success: true,
      message: 'Database tables retrieved successfully',
      tables: result.recordset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to retrieve database tables'
    });
  }
});

/**
 * Example: Create a simple log entry (you can modify this based on your needs)
 */
router.post('/log-entry', async (req, res) => {
  try {
    const { message, level = 'INFO', source = 'API' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Example query - you'll need to create the actual table structure
    const result = await databaseService.query(`
      INSERT INTO tblLogs (message, level, source, created_at)
      OUTPUT INSERTED.*
      VALUES (@message, @level, @source, GETDATE())
    `, {
      message,
      level,
      source
    });

    res.json({
      success: true,
      message: 'Log entry created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    // If table doesn't exist, provide helpful error message
    if (error.message.includes('Invalid object name')) {
      res.status(500).json({
        success: false,
        error: 'Logs table does not exist. Please create the table first.',
        sqlError: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to create log entry'
      });
    }
  }
});

/**
 * Example: Get recent log entries
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await databaseService.query(`
      SELECT TOP (@limit)
        id,
        message,
        level,
        source,
        created_at
      FROM tblLogs
      ORDER BY created_at DESC
    `, {
      limit
    });

    res.json({
      success: true,
      message: 'Log entries retrieved successfully',
      data: result.recordset
    });
  } catch (error) {
    if (error.message.includes('Invalid object name')) {
      res.status(500).json({
        success: false,
        error: 'Logs table does not exist. Please create the table first.',
        sqlError: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve log entries'
      });
    }
  }
});

/**
 * Create example logs table (for development)
 */
router.post('/create-logs-table', async (req, res) => {
  try {
    await databaseService.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblLogs' AND xtype='U')
      CREATE TABLE tblLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(MAX) NOT NULL,
        level NVARCHAR(50) DEFAULT 'INFO',
        source NVARCHAR(100) DEFAULT 'API',
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);

    res.json({
      success: true,
      message: 'Logs table created successfully (or already exists)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create logs table'
    });
  }
});

/**
 * Create users table for authentication system
 */
router.post('/create-users-table', async (req, res) => {
  try {
    await databaseService.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUsers' AND xtype='U')
      CREATE TABLE tblUsers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(100) NULL,
        last_name NVARCHAR(100) NULL,
        role NVARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      );

      -- Create index on email for faster lookups
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblUsers_email')
      CREATE INDEX IX_tblUsers_email ON tblUsers(email);

      -- Create trigger to update updated_at timestamp
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblUsers_updated_at')
      EXEC('
        CREATE TRIGGER TR_tblUsers_updated_at
        ON tblUsers
        AFTER UPDATE
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE tblUsers
          SET updated_at = GETDATE()
          FROM tblUsers u
          INNER JOIN inserted i ON u.id = i.id;
        END
      ');
    `);

    res.json({
      success: true,
      message: 'Users table created successfully (or already exists)',
      schema: {
        table: 'users',
        columns: [
          'id (INT, PRIMARY KEY, AUTO_INCREMENT)',
          'email (NVARCHAR(255), UNIQUE, NOT NULL)',
          'password_hash (NVARCHAR(255), NOT NULL)',
          'first_name (NVARCHAR(100), NULLABLE)',
          'last_name (NVARCHAR(100), NULLABLE)',
          'role (NVARCHAR(50), DEFAULT: user, CHECK: user|admin)',
          'is_active (BIT, DEFAULT: 1)',
          'created_at (DATETIME2, DEFAULT: GETDATE())',
          'updated_at (DATETIME2, DEFAULT: GETDATE())'
        ],
        indexes: ['IX_users_email'],
        triggers: ['TR_users_updated_at (auto-update updated_at)']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create users table'
    });
  }
});

module.exports = router;
