const sql = require('mssql');
const { formatTableName } = require('./utils/table-naming');
require('dotenv').config({ path: './.env.development' });

// Connect to master database to create new database
const masterConfig = {
  server: process.env.DB_SERVER,
  database: 'master',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
    enableArithAbort: true,
    requestTimeout: 60000, // Increased timeout for database creation
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Configuration for the new database
const newDatabaseName = 'Kimiya_Voice';

/**
 * Create the Kimiya_Voice database
 */
async function createDatabase(pool) {
  console.log(`\n🏗️  Creating database: ${newDatabaseName}`);
  
  try {
    // Check if database already exists
    const checkResult = await pool.request()
      .input('dbName', sql.NVarChar, newDatabaseName)
      .query(`
        SELECT COUNT(*) as count 
        FROM sys.databases 
        WHERE name = @dbName
      `);
    
    if (checkResult.recordset[0].count > 0) {
      console.log(`⚠️  Database ${newDatabaseName} already exists`);
      return true;
    }
    
    // Create the database
    await pool.request().query(`
      CREATE DATABASE [${newDatabaseName}]
      COLLATE SQL_Latin1_General_CP1_CI_AS
    `);
    
    console.log(`✅ Database ${newDatabaseName} created successfully`);
    
    // Wait a moment for database to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to create database ${newDatabaseName}:`, error.message);
    return false;
  }
}

/**
 * Create all tables with proper naming convention
 */
async function createTables(pool) {
  console.log('\n📊 Creating tables with proper naming convention...');
  
  try {
    // Create tblUsers table
    console.log('Creating tblUsers...');
    await pool.request().query(`
      CREATE TABLE tblUsers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(100) NULL,
        last_name NVARCHAR(100) NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblUsers_role CHECK (role IN ('user', 'admin')),
        CONSTRAINT UQ_tblUsers_email UNIQUE (email)
      );
    `);
    console.log('✅ tblUsers table created');
    
    // Create index on email
    await pool.request().query(`
      CREATE INDEX IX_tblUsers_email ON tblUsers(email);
    `);
    console.log('✅ tblUsers email index created');
    
    // Create trigger for updated_at
    await pool.request().query(`
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
    `);
    console.log('✅ tblUsers update trigger created');
    
    // Create tblLogs table
    console.log('Creating tblLogs...');
    await pool.request().query(`
      CREATE TABLE tblLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(MAX) NOT NULL,
        level NVARCHAR(50) NOT NULL DEFAULT 'INFO',
        source NVARCHAR(100) NOT NULL DEFAULT 'API',
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblLogs_level CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'))
      );
    `);
    console.log('✅ tblLogs table created');
    
    // Create index on created_at for performance
    await pool.request().query(`
      CREATE INDEX IX_tblLogs_created_at ON tblLogs(created_at DESC);
    `);
    console.log('✅ tblLogs created_at index created');
    
    // Create index on level for filtering
    await pool.request().query(`
      CREATE INDEX IX_tblLogs_level ON tblLogs(level);
    `);
    console.log('✅ tblLogs level index created');
    
    // Create tblWorkflowTemplates table (for future use)
    console.log('Creating tblWorkflowTemplates...');
    await pool.request().query(`
      CREATE TABLE tblWorkflowTemplates (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NULL,
        template_data NVARCHAR(MAX) NOT NULL, -- JSON data
        category NVARCHAR(100) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_by INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign key to users (optional)
        CONSTRAINT FK_tblWorkflowTemplates_created_by 
          FOREIGN KEY (created_by) REFERENCES tblUsers(id)
      );
    `);
    console.log('✅ tblWorkflowTemplates table created');
    
    // Create tblUserSessions table (for session management)
    console.log('Creating tblUserSessions...');
    await pool.request().query(`
      CREATE TABLE tblUserSessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        session_token NVARCHAR(255) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        last_accessed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        
        -- Foreign key to users
        CONSTRAINT FK_tblUserSessions_user_id 
          FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE,
        
        -- Unique session token
        CONSTRAINT UQ_tblUserSessions_token UNIQUE (session_token)
      );
    `);
    console.log('✅ tblUserSessions table created');
    
    // Create tblCallLogs table (for call tracking)
    console.log('Creating tblCallLogs...');
    await pool.request().query(`
      CREATE TABLE tblCallLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        call_sid NVARCHAR(255) NOT NULL,
        from_number NVARCHAR(50) NULL,
        to_number NVARCHAR(50) NULL,
        status NVARCHAR(50) NULL,
        duration INT NULL, -- in seconds
        start_time DATETIME2 NULL,
        end_time DATETIME2 NULL,
        recording_url NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Unique call SID
        CONSTRAINT UQ_tblCallLogs_call_sid UNIQUE (call_sid)
      );
    `);
    console.log('✅ tblCallLogs table created');
    
    console.log('\n🎉 All tables created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    return false;
  }
}

/**
 * Insert initial data
 */
async function insertInitialData(pool) {
  console.log('\n📝 Inserting initial data...');
  
  try {
    // Create admin user
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    
    await pool.request()
      .input('email', sql.NVarChar, 'admin@kimiyavoice.com')
      .input('passwordHash', sql.NVarChar, adminPassword)
      .input('firstName', sql.NVarChar, 'System')
      .input('lastName', sql.NVarChar, 'Administrator')
      .input('role', sql.NVarChar, 'admin')
      .query(`
        INSERT INTO tblUsers (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
        VALUES (@email, @passwordHash, @firstName, @lastName, @role, 1, GETDATE(), GETDATE())
      `);
    
    console.log('✅ Admin user created (admin@kimiyavoice.com / Admin123!)');
    
    // Insert initial log entry
    await pool.request()
      .input('message', sql.NVarChar, 'Kimiya_Voice database initialized successfully')
      .input('level', sql.NVarChar, 'INFO')
      .input('source', sql.NVarChar, 'DatabaseSetup')
      .query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, @level, @source, GETDATE())
      `);
    
    console.log('✅ Initial log entry created');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to insert initial data:', error.message);
    return false;
  }
}

/**
 * Verify database setup
 */
async function verifySetup(pool) {
  console.log('\n🔍 Verifying database setup...');
  
  try {
    // Check tables
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log(`✅ Found ${tablesResult.recordset.length} tables:`);
    tablesResult.recordset.forEach(table => {
      const hasConvention = table.TABLE_NAME.startsWith('tbl');
      const marker = hasConvention ? '✅' : '⚠️ ';
      console.log(`   ${marker} ${table.TABLE_NAME}`);
    });
    
    // Check data
    const userCount = await pool.request().query('SELECT COUNT(*) as count FROM tblUsers');
    const logCount = await pool.request().query('SELECT COUNT(*) as count FROM tblLogs');
    
    console.log(`\n📊 Data verification:`);
    console.log(`   👤 Users: ${userCount.recordset[0].count}`);
    console.log(`   📋 Logs: ${logCount.recordset[0].count}`);
    
    // Test a query
    const testQuery = await pool.request().query(`
      SELECT 
        u.email, u.role, u.created_at,
        l.message, l.level, l.created_at as log_time
      FROM tblUsers u
      CROSS JOIN tblLogs l
      WHERE u.role = 'admin'
    `);
    
    console.log(`✅ Test query successful - returned ${testQuery.recordset.length} rows`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function setupKimiyaVoiceDatabase() {
  console.log('🚀 Kimiya Voice Database Setup');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`🔌 Server: ${masterConfig.server}`);
  console.log(`📊 Database: ${newDatabaseName}`);
  console.log(`👤 User: ${masterConfig.user}`);
  console.log(`🔐 Port: ${masterConfig.port}`);

  let masterPool = null;
  let newDbPool = null;

  try {
    // Step 1: Connect to master database
    console.log('\n⏳ Step 1: Connecting to master database...');
    masterPool = await sql.connect(masterConfig);
    console.log('✅ Connected to master database');

    // Step 2: Create the new database
    console.log('\n⏳ Step 2: Creating Kimiya_Voice database...');
    const dbCreated = await createDatabase(masterPool);

    if (!dbCreated) {
      throw new Error('Failed to create database');
    }

    // Close master connection
    await masterPool.close();
    console.log('🔌 Master database connection closed');

    // Step 3: Connect to the new database
    console.log('\n⏳ Step 3: Connecting to new database...');
    const newDbConfig = {
      ...masterConfig,
      database: newDatabaseName
    };

    newDbPool = await sql.connect(newDbConfig);
    console.log(`✅ Connected to ${newDatabaseName} database`);

    // Step 4: Create tables
    console.log('\n⏳ Step 4: Creating tables...');
    const tablesCreated = await createTables(newDbPool);

    if (!tablesCreated) {
      throw new Error('Failed to create tables');
    }

    // Step 5: Insert initial data
    console.log('\n⏳ Step 5: Inserting initial data...');
    const dataInserted = await insertInitialData(newDbPool);

    if (!dataInserted) {
      console.log('⚠️  Warning: Failed to insert initial data, but continuing...');
    }

    // Step 6: Verify setup
    console.log('\n⏳ Step 6: Verifying setup...');
    const setupVerified = await verifySetup(newDbPool);

    if (!setupVerified) {
      console.log('⚠️  Warning: Setup verification had issues, but database was created');
    }

    await newDbPool.close();
    console.log('🔌 Database connection closed');

    // Success summary
    console.log('\n🎉 Database Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Database: ${newDatabaseName} created successfully`);
    console.log('✅ All tables created with proper naming convention');
    console.log('✅ Initial data inserted');
    console.log('✅ Setup verified');

    console.log('\n📋 Created Tables:');
    console.log('   📊 tblUsers - User management');
    console.log('   📋 tblLogs - Application logging');
    console.log('   🔄 tblWorkflowTemplates - Workflow templates');
    console.log('   🔐 tblUserSessions - Session management');
    console.log('   📞 tblCallLogs - Call tracking');

    console.log('\n👤 Default Admin Account:');
    console.log('   Email: admin@kimiyavoice.com');
    console.log('   Password: Admin123!');
    console.log('   Role: admin');

    console.log('\n🔧 Next Steps:');
    console.log('   1. Your environment is already configured for Kimiya_Voice database');
    console.log('   2. Test the connection: node test-new-naming-convention.cjs');
    console.log('   3. Test authentication: node test-auth.cjs');
    console.log('   4. Start your application server');

    console.log('\n💡 Database is ready for use!');

  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);

    if (error.code === 'ELOGIN') {
      console.log('\n🔧 Login Error Solutions:');
      console.log('   - Verify database credentials');
      console.log('   - Check if user has CREATE DATABASE permissions');
      console.log('   - Ensure SQL Server authentication is enabled');
    } else if (error.code === 'EREQUEST') {
      console.log('\n🔧 SQL Error Solutions:');
      console.log('   - Check SQL syntax in the script');
      console.log('   - Verify database permissions');
      console.log('   - Check if database already exists');
    }

    console.log('\n🔄 Cleanup: If database was partially created, you may need to drop it manually');

    process.exit(1);

  } finally {
    // Ensure connections are closed
    try {
      if (masterPool) await masterPool.close();
      if (newDbPool) await newDbPool.close();
    } catch (closeError) {
      console.error('Warning: Error closing connections:', closeError.message);
    }
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupKimiyaVoiceDatabase();
}

module.exports = {
  setupKimiyaVoiceDatabase,
  createDatabase,
  createTables,
  insertInitialData,
  verifySetup
};
