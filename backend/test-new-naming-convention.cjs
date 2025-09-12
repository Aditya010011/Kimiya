const sql = require('mssql');
const { formatTableName, isValidTableName, getStandardTableNames } = require('./utils/table-naming');
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
 * Test table naming convention utilities
 */
function testNamingConventionUtils() {
  console.log('\n🧪 Testing Table Naming Convention Utilities...');
  
  const testCases = [
    { input: 'users', expected: 'tblUsers' },
    { input: 'workflow_templates', expected: 'tblWorkflowTemplates' },
    { input: 'user_sessions', expected: 'tblUserSessions' },
    { input: 'call_logs', expected: 'tblCallLogs' },
    { input: 'conversation_history', expected: 'tblConversationHistory' }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  testCases.forEach(({ input, expected }) => {
    const result = formatTableName(input);
    const isValid = isValidTableName(result);
    const status = result === expected && isValid ? '✅' : '❌';
    
    console.log(`  ${status} ${input} → ${result} (expected: ${expected}, valid: ${isValid})`);
    
    if (result === expected && isValid) passed++;
  });
  
  console.log(`\n📊 Naming Convention Tests: ${passed}/${total} passed`);
  return passed === total;
}

/**
 * Test database connection with new database name
 */
async function testDatabaseConnection(pool) {
  console.log('\n🔌 Testing Database Connection...');
  
  try {
    const result = await pool.request().query(`
      SELECT
        GETDATE() as current_datetime,
        DB_NAME() as database_name,
        USER_NAME() as current_user_name
    `);
    
    const dbInfo = result.recordset[0];
    console.log(`✅ Connected to database: ${dbInfo.database_name}`);
    console.log(`👤 User: ${dbInfo.current_user_name}`);
    console.log(`⏰ Time: ${dbInfo.current_datetime}`);
    
    return dbInfo.database_name === 'Kimiya_Voice';
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Test table creation with new naming convention
 */
async function testTableCreation(pool) {
  console.log('\n🏗️  Testing Table Creation with New Naming Convention...');
  
  try {
    // Create tblUsers table
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
    console.log('✅ tblUsers table created/verified');
    
    // Create tblLogs table
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
    console.log('✅ tblLogs table created/verified');
    
    return true;
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    return false;
  }
}

/**
 * Test data operations with new table names
 */
async function testDataOperations(pool) {
  console.log('\n📝 Testing Data Operations...');
  
  try {
    // Test log entry
    const logResult = await pool.request()
      .input('message', sql.NVarChar, 'Testing new naming convention')
      .input('level', sql.NVarChar, 'INFO')
      .input('source', sql.NVarChar, 'NamingConventionTest')
      .query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        OUTPUT INSERTED.*
        VALUES (@message, @level, @source, GETDATE())
      `);
    
    console.log('✅ Log entry created successfully');
    console.log(`   ID: ${logResult.recordset[0].id}, Message: "${logResult.recordset[0].message}"`);
    
    // Test reading logs
    const readResult = await pool.request().query(`
      SELECT TOP 3 id, message, level, source, created_at
      FROM tblLogs
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ Retrieved ${readResult.recordset.length} log entries`);
    readResult.recordset.forEach(log => {
      console.log(`   [${log.level}] ${log.message} (${log.source})`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Data operations failed:', error.message);
    return false;
  }
}

/**
 * Verify all tables follow naming convention
 */
async function verifyTableNamingConvention(pool) {
  console.log('\n📋 Verifying Table Naming Convention...');
  
  try {
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    const tables = result.recordset.map(row => row.TABLE_NAME);
    console.log(`Found ${tables.length} tables:`);
    
    let conventionCompliant = 0;
    tables.forEach(tableName => {
      const isCompliant = isValidTableName(tableName);
      const status = isCompliant ? '✅' : '⚠️ ';
      console.log(`  ${status} ${tableName}`);
      if (isCompliant) conventionCompliant++;
    });
    
    console.log(`\n📊 Convention Compliance: ${conventionCompliant}/${tables.length} tables follow naming convention`);
    
    return { total: tables.length, compliant: conventionCompliant, tables };
  } catch (error) {
    console.error('❌ Table verification failed:', error.message);
    return { total: 0, compliant: 0, tables: [] };
  }
}

/**
 * Main test function
 */
async function runNamingConventionTests() {
  console.log('🚀 Starting Database Naming Convention Tests...');
  console.log(`📍 Database: ${config.database}`);
  console.log(`🔌 Server: ${config.server}`);
  
  const results = {
    namingUtils: false,
    databaseConnection: false,
    tableCreation: false,
    dataOperations: false,
    namingConvention: { total: 0, compliant: 0 }
  };
  
  try {
    // Test naming convention utilities
    results.namingUtils = testNamingConventionUtils();
    
    // Connect to database
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    // Run tests
    results.databaseConnection = await testDatabaseConnection(pool);
    results.tableCreation = await testTableCreation(pool);
    results.dataOperations = await testDataOperations(pool);
    results.namingConvention = await verifyTableNamingConvention(pool);
    
    await pool.close();
    console.log('\n🔌 Database connection closed successfully');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:');
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
  }
  
  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const tests = [
    { name: 'Naming Convention Utilities', passed: results.namingUtils },
    { name: 'Database Connection (Kimiya_Voice)', passed: results.databaseConnection },
    { name: 'Table Creation (tbl prefix)', passed: results.tableCreation },
    { name: 'Data Operations (new tables)', passed: results.dataOperations }
  ];
  
  let passedTests = 0;
  tests.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
    if (test.passed) passedTests++;
  });
  
  console.log(`\n📋 Table Naming Convention Compliance:`);
  console.log(`   ${results.namingConvention.compliant}/${results.namingConvention.total} tables follow convention`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 Overall: ${passedTests}/${tests.length} core tests passed`);
  
  if (passedTests === tests.length && results.namingConvention.compliant > 0) {
    console.log('🎉 Database naming convention migration successful!');
  } else {
    console.log('⚠️  Some tests failed or tables need to be migrated.');
    console.log('💡 Run the migration script: node backend/migrate-table-names.cjs');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runNamingConventionTests();
}

module.exports = {
  runNamingConventionTests,
  testNamingConventionUtils,
  testDatabaseConnection,
  testTableCreation,
  testDataOperations,
  verifyTableNamingConvention
};
