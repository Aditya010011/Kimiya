const sql = require('mssql');
const { getMigrationMapping, generateRenameSQL, formatTableName } = require('./utils/table-naming');
require('dotenv').config({ path: './.env.development' });

// Validate required environment variables
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required database environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env.development file');
  process.exit(1);
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Get list of existing tables in the database
 */
async function getExistingTables(pool) {
  const result = await pool.request().query(`
    SELECT 
      TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  
  return result.recordset.map(row => row.TABLE_NAME);
}

/**
 * Check if a table exists
 */
async function tableExists(pool, tableName) {
  const result = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName AND TABLE_TYPE = 'BASE TABLE'
    `);
  
  return result.recordset[0].count > 0;
}

/**
 * Rename a table with proper error handling
 */
async function renameTable(pool, oldName, newName) {
  try {
    console.log(`🔄 Renaming table: ${oldName} -> ${newName}`);
    
    // Check if old table exists
    if (!(await tableExists(pool, oldName))) {
      console.log(`⚠️  Table ${oldName} does not exist, skipping...`);
      return false;
    }
    
    // Check if new table already exists
    if (await tableExists(pool, newName)) {
      console.log(`⚠️  Table ${newName} already exists, skipping rename of ${oldName}...`);
      return false;
    }
    
    // Perform the rename
    await pool.request().query(`EXEC sp_rename '${oldName}', '${newName}'`);
    console.log(`✅ Successfully renamed ${oldName} to ${newName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to rename ${oldName} to ${newName}:`, error.message);
    return false;
  }
}

/**
 * Create new tables with proper naming convention
 */
async function createNewTables(pool) {
  console.log('\n🏗️  Creating tables with new naming convention...');
  
  // Create tblUsers table
  console.log('Creating tblUsers...');
  await pool.request().query(`
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
  `);
  
  // Create index on email
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblUsers_email')
    CREATE INDEX IX_tblUsers_email ON tblUsers(email);
  `);
  
  // Create update trigger
  await pool.request().query(`
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
  
  // Create tblLogs table
  console.log('Creating tblLogs...');
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblLogs' AND xtype='U')
    CREATE TABLE tblLogs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      message NVARCHAR(MAX) NOT NULL,
      level NVARCHAR(50) DEFAULT 'INFO',
      source NVARCHAR(100) DEFAULT 'API',
      created_at DATETIME2 DEFAULT GETDATE()
    );
  `);
  
  console.log('✅ New tables created successfully!');
}

/**
 * Migrate data from old tables to new tables
 */
async function migrateData(pool) {
  console.log('\n📦 Migrating data from old tables to new tables...');
  
  const migrationMapping = getMigrationMapping();
  
  for (const [oldName, newName] of Object.entries(migrationMapping)) {
    try {
      const oldExists = await tableExists(pool, oldName);
      const newExists = await tableExists(pool, newName);
      
      if (oldExists && newExists) {
        console.log(`🔄 Migrating data: ${oldName} -> ${newName}`);
        
        // Get column names from old table
        const columnsResult = await pool.request().query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${oldName}'
          ORDER BY ORDINAL_POSITION
        `);
        
        const columns = columnsResult.recordset.map(row => row.COLUMN_NAME).join(', ');
        
        // Copy data
        await pool.request().query(`
          INSERT INTO ${newName} (${columns})
          SELECT ${columns}
          FROM ${oldName}
        `);
        
        console.log(`✅ Data migrated from ${oldName} to ${newName}`);
      } else if (!oldExists) {
        console.log(`⚠️  Old table ${oldName} does not exist, skipping data migration...`);
      } else if (!newExists) {
        console.log(`⚠️  New table ${newName} does not exist, skipping data migration...`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate data from ${oldName} to ${newName}:`, error.message);
    }
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Table Naming Convention Migration...');
  console.log(`📍 Database: ${config.database}`);
  console.log(`🔌 Server: ${config.server}`);
  
  try {
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    // Get existing tables
    console.log('\n📋 Getting existing tables...');
    const existingTables = await getExistingTables(pool);
    console.log(`Found ${existingTables.length} existing tables:`);
    existingTables.forEach(table => console.log(`  - ${table}`));
    
    // Create new tables first
    await createNewTables(pool);
    
    // Migrate data if old tables exist
    await migrateData(pool);
    
    // Rename existing tables (if they haven't been migrated yet)
    console.log('\n🔄 Renaming existing tables...');
    const migrationMapping = getMigrationMapping();
    let renamedCount = 0;
    
    for (const [oldName, newName] of Object.entries(migrationMapping)) {
      const renamed = await renameTable(pool, oldName, newName);
      if (renamed) renamedCount++;
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  - Tables processed: ${Object.keys(migrationMapping).length}`);
    console.log(`  - Tables renamed: ${renamedCount}`);
    
    // Show final table list
    console.log('\n📋 Final table list:');
    const finalTables = await getExistingTables(pool);
    finalTables.forEach(table => {
      const isNewFormat = table.startsWith('tbl');
      const status = isNewFormat ? '✅' : '⚠️ ';
      console.log(`  ${status} ${table}`);
    });
    
    await pool.close();
    console.log('\n🔌 Database connection closed successfully');
    console.log('\n🎉 Table naming convention migration completed!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('State:', error.state);
    console.error('Class:', error.class);
    console.error('Server:', error.server);
    console.error('Procedure:', error.procName);
    console.error('Line:', error.lineNumber);
    
    if (error.originalError) {
      console.error('Original Error:', error.originalError.message);
    }
    
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  renameTable,
  createNewTables,
  migrateData
};
