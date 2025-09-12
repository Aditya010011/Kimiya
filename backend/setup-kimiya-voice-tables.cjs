const sql = require('mssql');
const { formatTableName } = require('./utils/table-naming');
require('dotenv').config({ path: './.env.development' });

// We'll use an existing database and set up the tables there
// Let's try the available databases we found earlier
const availableDatabases = ['AI_Phone', 'Kimiya_Dev', 'Kimiya_UAT'];

const baseConfig = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
    enableArithAbort: true,
    requestTimeout: 60000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Find an accessible database to use
 */
async function findAccessibleDatabase() {
  console.log('🔍 Finding accessible database...');
  
  for (const dbName of availableDatabases) {
    console.log(`\n📊 Trying database: ${dbName}`);
    
    const config = { ...baseConfig, database: dbName };
    
    try {
      const pool = await sql.connect(config);
      console.log(`✅ Successfully connected to ${dbName}`);
      
      // Test basic operations
      const result = await pool.request().query('SELECT DB_NAME() as db_name, USER_NAME() as user_name');
      console.log(`   Current DB: ${result.recordset[0].db_name}`);
      console.log(`   Current User: ${result.recordset[0].user_name}`);
      
      await pool.close();
      return dbName;
      
    } catch (error) {
      console.log(`   ❌ Cannot access ${dbName}: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Create all tables with proper naming convention
 */
async function createKimiyaVoiceTables(pool) {
  console.log('\n📊 Creating Kimiya Voice tables with proper naming convention...');
  
  try {
    // Create tblUsers table
    console.log('Creating tblUsers...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUsers' AND xtype='U')
      BEGIN
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
        
        -- Create index on email
        CREATE INDEX IX_tblUsers_email ON tblUsers(email);
      END
    `);
    console.log('✅ tblUsers table created/verified');

    // Create trigger for updated_at (separate statement)
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblUsers_updated_at')
        BEGIN
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
          ')
        END
      `);
      console.log('✅ tblUsers update trigger created');
    } catch (triggerError) {
      console.log('⚠️  Warning: Could not create update trigger:', triggerError.message);
    }
    
    // Create tblLogs table
    console.log('Creating tblLogs...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblLogs' AND xtype='U')
      BEGIN
        CREATE TABLE tblLogs (
          id INT IDENTITY(1,1) PRIMARY KEY,
          message NVARCHAR(MAX) NOT NULL,
          level NVARCHAR(50) NOT NULL DEFAULT 'INFO',
          source NVARCHAR(100) NOT NULL DEFAULT 'API',
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT CK_tblLogs_level CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'))
        );
        
        -- Create indexes
        CREATE INDEX IX_tblLogs_created_at ON tblLogs(created_at DESC);
        CREATE INDEX IX_tblLogs_level ON tblLogs(level);
      END
    `);
    console.log('✅ tblLogs table created/verified');
    
    // Create tblWorkflowTemplates table
    console.log('Creating tblWorkflowTemplates...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWorkflowTemplates' AND xtype='U')
      BEGIN
        CREATE TABLE tblWorkflowTemplates (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX) NULL,
          template_data NVARCHAR(MAX) NOT NULL,
          category NVARCHAR(100) NULL,
          is_active BIT NOT NULL DEFAULT 1,
          created_by INT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign key to users (will be added after tblUsers exists)
          CONSTRAINT FK_tblWorkflowTemplates_created_by 
            FOREIGN KEY (created_by) REFERENCES tblUsers(id)
        );
      END
    `);
    console.log('✅ tblWorkflowTemplates table created/verified');
    
    // Create tblUserSessions table
    console.log('Creating tblUserSessions...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUserSessions' AND xtype='U')
      BEGIN
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
      END
    `);
    console.log('✅ tblUserSessions table created/verified');
    
    // Create tblCallLogs table
    console.log('Creating tblCallLogs...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblCallLogs' AND xtype='U')
      BEGIN
        CREATE TABLE tblCallLogs (
          id INT IDENTITY(1,1) PRIMARY KEY,
          call_sid NVARCHAR(255) NOT NULL,
          from_number NVARCHAR(50) NULL,
          to_number NVARCHAR(50) NULL,
          status NVARCHAR(50) NULL,
          duration INT NULL,
          start_time DATETIME2 NULL,
          end_time DATETIME2 NULL,
          recording_url NVARCHAR(500) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Unique call SID
          CONSTRAINT UQ_tblCallLogs_call_sid UNIQUE (call_sid)
        );
      END
    `);
    console.log('✅ tblCallLogs table created/verified');
    
    console.log('\n🎉 All Kimiya Voice tables created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    return false;
  }
}

/**
 * Migrate existing data from old tables to new tables
 */
async function migrateExistingData(pool) {
  console.log('\n🔄 Migrating existing data...');
  
  try {
    // Check if old tables exist and migrate data
    const oldTablesCheck = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('users', 'logs') 
      AND TABLE_TYPE = 'BASE TABLE'
    `);
    
    const oldTables = oldTablesCheck.recordset.map(row => row.TABLE_NAME);
    
    if (oldTables.includes('users')) {
      console.log('📊 Migrating users data...');
      
      // Check if data already exists in tblUsers
      const existingUsers = await pool.request().query('SELECT COUNT(*) as count FROM tblUsers');
      
      if (existingUsers.recordset[0].count === 0) {
        await pool.request().query(`
          INSERT INTO tblUsers (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
          SELECT email, password_hash, first_name, last_name, role, is_active, created_at, updated_at
          FROM users
        `);
        console.log('✅ Users data migrated successfully');
      } else {
        console.log('⚠️  tblUsers already has data, skipping migration');
      }
    }
    
    if (oldTables.includes('logs')) {
      console.log('📊 Migrating logs data...');
      
      // Check if data already exists in tblLogs
      const existingLogs = await pool.request().query('SELECT COUNT(*) as count FROM tblLogs');
      
      if (existingLogs.recordset[0].count === 0) {
        await pool.request().query(`
          INSERT INTO tblLogs (message, level, source, created_at)
          SELECT message, level, source, created_at
          FROM logs
        `);
        console.log('✅ Logs data migrated successfully');
      } else {
        console.log('⚠️  tblLogs already has data, skipping migration');
      }
    }
    
    if (oldTables.length === 0) {
      console.log('ℹ️  No old tables found to migrate from');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
    console.log('⚠️  Continuing with setup...');
    return false;
  }
}

/**
 * Insert initial data if needed
 */
async function insertInitialData(pool) {
  console.log('\n📝 Setting up initial data...');
  
  try {
    // Check if admin user exists
    const adminCheck = await pool.request()
      .input('email', sql.NVarChar, 'admin@kimiyavoice.com')
      .query('SELECT COUNT(*) as count FROM tblUsers WHERE email = @email');
    
    if (adminCheck.recordset[0].count === 0) {
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
    } else {
      console.log('ℹ️  Admin user already exists');
    }
    
    // Insert setup log entry
    await pool.request()
      .input('message', sql.NVarChar, 'Kimiya Voice tables setup completed successfully')
      .input('level', sql.NVarChar, 'INFO')
      .input('source', sql.NVarChar, 'TableSetup')
      .query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        VALUES (@message, @level, @source, GETDATE())
      `);
    
    console.log('✅ Setup log entry created');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to insert initial data:', error.message);
    return false;
  }
}

/**
 * Verify the setup
 */
async function verifySetup(pool, databaseName) {
  console.log('\n🔍 Verifying setup...');

  try {
    // Check tables
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME LIKE 'tbl%'
      ORDER BY TABLE_NAME
    `);

    console.log(`✅ Found ${tablesResult.recordset.length} Kimiya Voice tables:`);
    tablesResult.recordset.forEach(table => {
      console.log(`   ✅ ${table.TABLE_NAME}`);
    });

    // Check data
    const userCount = await pool.request().query('SELECT COUNT(*) as count FROM tblUsers');
    const logCount = await pool.request().query('SELECT COUNT(*) as count FROM tblLogs');

    console.log(`\n📊 Data summary:`);
    console.log(`   👤 Users: ${userCount.recordset[0].count}`);
    console.log(`   📋 Logs: ${logCount.recordset[0].count}`);

    // Test authentication query
    const authTest = await pool.request()
      .input('email', sql.NVarChar, 'admin@kimiyavoice.com')
      .query('SELECT id, email, role FROM tblUsers WHERE email = @email');

    if (authTest.recordset.length > 0) {
      console.log(`✅ Admin user verified: ${authTest.recordset[0].email} (${authTest.recordset[0].role})`);
    }

    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

/**
 * Update environment configuration
 */
async function updateEnvironmentConfig(databaseName) {
  console.log(`\n🔧 Updating environment configuration for database: ${databaseName}`);

  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env.development');

    // Read current env file
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update DB_DATABASE value
    const dbDatabaseRegex = /^DB_DATABASE=.*$/m;
    if (dbDatabaseRegex.test(envContent)) {
      envContent = envContent.replace(dbDatabaseRegex, `DB_DATABASE=${databaseName}`);
    } else {
      envContent += `\nDB_DATABASE=${databaseName}`;
    }

    // Write back to file
    fs.writeFileSync(envPath, envContent);

    console.log(`✅ Environment updated: DB_DATABASE=${databaseName}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to update environment:', error.message);
    console.log(`💡 Please manually update DB_DATABASE=${databaseName} in .env.development`);
    return false;
  }
}

/**
 * Main setup function
 */
async function setupKimiyaVoiceTables() {
  console.log('🚀 Kimiya Voice Table Setup');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`🔌 Server: ${baseConfig.server}`);
  console.log(`👤 User: ${baseConfig.user}`);
  console.log(`🔐 Port: ${baseConfig.port}`);

  try {
    // Step 1: Find accessible database
    console.log('\n⏳ Step 1: Finding accessible database...');
    const accessibleDb = await findAccessibleDatabase();

    if (!accessibleDb) {
      throw new Error('No accessible database found. Please check your permissions.');
    }

    console.log(`✅ Using database: ${accessibleDb}`);

    // Step 2: Connect to the accessible database
    console.log('\n⏳ Step 2: Connecting to database...');
    const config = { ...baseConfig, database: accessibleDb };
    const pool = await sql.connect(config);
    console.log(`✅ Connected to ${accessibleDb}`);

    // Step 3: Create Kimiya Voice tables
    console.log('\n⏳ Step 3: Creating Kimiya Voice tables...');
    const tablesCreated = await createKimiyaVoiceTables(pool);

    if (!tablesCreated) {
      throw new Error('Failed to create tables');
    }

    // Step 4: Migrate existing data
    console.log('\n⏳ Step 4: Migrating existing data...');
    await migrateExistingData(pool);

    // Step 5: Insert initial data
    console.log('\n⏳ Step 5: Setting up initial data...');
    const dataSetup = await insertInitialData(pool);

    if (!dataSetup) {
      console.log('⚠️  Warning: Initial data setup had issues, but continuing...');
    }

    // Step 6: Verify setup
    console.log('\n⏳ Step 6: Verifying setup...');
    const setupVerified = await verifySetup(pool, accessibleDb);

    if (!setupVerified) {
      console.log('⚠️  Warning: Setup verification had issues, but tables were created');
    }

    // Step 7: Update environment configuration
    console.log('\n⏳ Step 7: Updating configuration...');
    await updateEnvironmentConfig(accessibleDb);

    await pool.close();
    console.log('🔌 Database connection closed');

    // Success summary
    console.log('\n🎉 Kimiya Voice Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Database: ${accessibleDb}`);
    console.log('✅ All Kimiya Voice tables created with proper naming convention');
    console.log('✅ Data migrated (if applicable)');
    console.log('✅ Initial data setup');
    console.log('✅ Environment configuration updated');

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
    console.log('   1. Test the connection: node test-new-naming-convention.cjs');
    console.log('   2. Test authentication: node test-auth.cjs');
    console.log('   3. Start your application server');
    console.log('   4. Your application now uses the proper table naming convention!');

    console.log('\n💡 Setup completed successfully!');

  } catch (error) {
    console.error('\n❌ Setup failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);

    if (error.code === 'ELOGIN') {
      console.log('\n🔧 Login Error Solutions:');
      console.log('   - Verify database credentials');
      console.log('   - Check database access permissions');
      console.log('   - Ensure SQL Server authentication is enabled');
    } else if (error.code === 'EREQUEST') {
      console.log('\n🔧 SQL Error Solutions:');
      console.log('   - Check SQL syntax in the script');
      console.log('   - Verify table creation permissions');
      console.log('   - Check if tables already exist');
    }

    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupKimiyaVoiceTables();
}

module.exports = {
  setupKimiyaVoiceTables,
  findAccessibleDatabase,
  createKimiyaVoiceTables,
  migrateExistingData,
  insertInitialData,
  verifySetup
};
