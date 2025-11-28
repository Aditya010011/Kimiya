const sql = require('mssql');
const path = require('path');

// Load environment variables from the root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || false,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || true,
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

async function addTokenTrackingColumns() {
  console.log('🚀 Starting token tracking columns migration...\n');
  
  let pool;
  try {
    // Connect to database
    console.log('📊 Connecting to database...');
    console.log(`   Server: ${config.server}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Encrypt: ${config.options.encrypt}`);
    console.log(`   Trust Server Certificate: ${config.options.trustServerCertificate}\n`);
    
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    // 1. Add columns to tblChatSessions
    console.log('📝 Adding token tracking columns to tblChatSessions...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblChatSessions') 
        AND name = 'total_prompt_tokens'
      )
      BEGIN
        ALTER TABLE tblChatSessions
        ADD total_prompt_tokens INT NULL DEFAULT 0,
            total_completion_tokens INT NULL DEFAULT 0,
            total_tokens INT NULL DEFAULT 0;
        
        PRINT '✅ Added token columns to tblChatSessions';
      END
      ELSE
      BEGIN
        PRINT '⚠️  Token columns already exist in tblChatSessions';
      END
    `);
    console.log('✅ tblChatSessions updated\n');

    // 2. Add columns to tblChatMessages
    console.log('📝 Adding token tracking columns to tblChatMessages...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblChatMessages') 
        AND name = 'prompt_tokens'
      )
      BEGIN
        ALTER TABLE tblChatMessages
        ADD prompt_tokens INT NULL DEFAULT 0,
            completion_tokens INT NULL DEFAULT 0,
            total_tokens INT NULL DEFAULT 0;
        
        PRINT '✅ Added token columns to tblChatMessages';
      END
      ELSE
      BEGIN
        PRINT '⚠️  Token columns already exist in tblChatMessages';
      END
    `);
    console.log('✅ tblChatMessages updated\n');

    // 3. Add columns to tblCallLogs (for voice call sessions)
    console.log('📝 Adding token tracking columns to tblCallLogs...');
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCallLogs') 
        AND name = 'total_prompt_tokens'
      )
      BEGIN
        ALTER TABLE tblCallLogs
        ADD total_prompt_tokens INT NULL DEFAULT 0,
            total_completion_tokens INT NULL DEFAULT 0,
            total_tokens INT NULL DEFAULT 0;
        
        PRINT '✅ Added token columns to tblCallLogs';
      END
      ELSE
      BEGIN
        PRINT '⚠️  Token columns already exist in tblCallLogs';
      END
    `);
    console.log('✅ tblCallLogs updated\n');

    // 4. Verify the changes
    console.log('🔍 Verifying changes...\n');
    
    const chatSessionsColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblChatSessions'
      AND COLUMN_NAME IN ('total_prompt_tokens', 'total_completion_tokens', 'total_tokens')
      ORDER BY COLUMN_NAME
    `);
    
    const chatMessagesColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblChatMessages'
      AND COLUMN_NAME IN ('prompt_tokens', 'completion_tokens', 'total_tokens')
      ORDER BY COLUMN_NAME
    `);
    
    const callLogsColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblCallLogs'
      AND COLUMN_NAME IN ('total_prompt_tokens', 'total_completion_tokens', 'total_tokens')
      ORDER BY COLUMN_NAME
    `);

    console.log('✅ tblChatSessions columns:');
    chatSessionsColumns.recordset.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\n✅ tblChatMessages columns:');
    chatMessagesColumns.recordset.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\n✅ tblCallLogs columns:');
    callLogsColumns.recordset.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\n🎉 Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:');
    console.error(`   Message: ${error.message}`);
    if (error.code) console.error(`   Code: ${error.code}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
addTokenTrackingColumns();
