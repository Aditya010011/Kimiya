const sql = require('mssql');
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

async function testDatabaseConnection() {
  console.log('🔌 Testing MSSQL database connection...');
  console.log(`📍 Server: ${config.server}`);
  console.log(`📊 Database: ${config.database}`);
  console.log(`👤 User: ${config.user}`);
  console.log(`🔐 Port: ${config.port}`);
  console.log(`🔒 Encrypt: ${config.options.encrypt}`);
  
  try {
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    console.log('\n🧪 Running test query...');
    const result = await pool.request().query(`
      SELECT
        GETDATE() as current_datetime,
        @@VERSION as sql_version,
        DB_NAME() as database_name,
        USER_NAME() as current_user_name
    `);
    
    console.log('✅ Test query successful!');
    console.log('📊 Results:');
    console.log(JSON.stringify(result.recordset[0], null, 2));
    
    console.log('\n📋 Getting database tables...');
    const tablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    console.log(`✅ Found ${tablesResult.recordset.length} tables:`);
    tablesResult.recordset.forEach(table => {
      console.log(`  - ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
    });
    
    console.log('\n🔧 Creating test logs table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblLogs' AND xtype='U')
      CREATE TABLE tblLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        message NVARCHAR(MAX) NOT NULL,
        level NVARCHAR(50) DEFAULT 'INFO',
        source NVARCHAR(100) DEFAULT 'API',
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('✅ Logs table created/verified!');
    
    console.log('\n📝 Inserting test log entry...');
    const insertResult = await pool.request()
      .input('message', sql.NVarChar, 'Database connection test successful')
      .input('level', sql.NVarChar, 'INFO')
      .input('source', sql.NVarChar, 'TestScript')
      .query(`
        INSERT INTO tblLogs (message, level, source, created_at)
        OUTPUT INSERTED.*
        VALUES (@message, @level, @source, GETDATE())
      `);
    
    console.log('✅ Test log entry created:');
    console.log(JSON.stringify(insertResult.recordset[0], null, 2));
    
    console.log('\n📖 Reading recent log entries...');
    const logsResult = await pool.request().query(`
      SELECT TOP 5
        id,
        message,
        level,
        source,
        created_at
      FROM tblLogs
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ Found ${logsResult.recordset.length} recent log entries:`);
    logsResult.recordset.forEach(log => {
      console.log(`  [${log.level}] ${log.message} (${log.source}) - ${log.created_at}`);
    });
    
    await pool.close();
    console.log('\n🔌 Database connection closed successfully');
    console.log('\n🎉 All database tests passed!');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
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

testDatabaseConnection();
