const sql = require('mssql');
require('dotenv').config({ path: './.env.development' });

// Validate required environment variables
const requiredEnvVars = ['DB_SERVER', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required database environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env.development file');
  process.exit(1);
}

// Connect to master database to list all databases
const masterConfig = {
  server: process.env.DB_SERVER,
  database: 'master', // Connect to master database
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

// Also try with the configured database
const configuredDbConfig = {
  ...masterConfig,
  database: process.env.DB_DATABASE || 'AI_Phone'
};

/**
 * List all databases on the server
 */
async function listAllDatabases() {
  console.log('🔍 Listing All Databases on Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔌 Server: ${masterConfig.server}`);
  console.log(`👤 User: ${masterConfig.user}`);
  console.log(`🔐 Port: ${masterConfig.port}`);
  console.log(`🔒 Encryption: ${masterConfig.options.encrypt}`);
  
  try {
    console.log('\n⏳ Connecting to master database...');
    const pool = await sql.connect(masterConfig);
    console.log('✅ Connected to master database successfully!');
    
    // Get server information
    const serverInfo = await pool.request().query(`
      SELECT 
        @@SERVERNAME as server_name,
        @@VERSION as sql_version,
        GETDATE() as current_time
    `);
    
    const info = serverInfo.recordset[0];
    console.log(`\n🖥️  Server Name: ${info.server_name}`);
    console.log(`⏰ Current Time: ${info.current_time}`);
    console.log(`📋 SQL Version: ${info.sql_version.split('\n')[0]}`);
    
    // List all databases
    const result = await pool.request().query(`
      SELECT 
        name as database_name,
        database_id,
        create_date,
        collation_name,
        state_desc as status,
        recovery_model_desc as recovery_model,
        compatibility_level,
        CASE 
          WHEN name IN ('master', 'tempdb', 'model', 'msdb') THEN 'System Database'
          ELSE 'User Database'
        END as database_type
      FROM sys.databases
      ORDER BY database_type, name
    `);
    
    console.log(`\n📊 Found ${result.recordset.length} database(s):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const systemDbs = result.recordset.filter(db => db.database_type === 'System Database');
    const userDbs = result.recordset.filter(db => db.database_type === 'User Database');
    
    if (systemDbs.length > 0) {
      console.log('\n🔧 System Databases:');
      systemDbs.forEach(db => {
        console.log(`   📁 ${db.database_name} (${db.status})`);
      });
    }
    
    if (userDbs.length > 0) {
      console.log('\n👤 User Databases:');
      userDbs.forEach(db => {
        const isTarget = db.database_name === process.env.DB_DATABASE;
        const marker = isTarget ? '👉' : '  ';
        console.log(`${marker} 📁 ${db.database_name}`);
        console.log(`     Status: ${db.status}`);
        console.log(`     Created: ${db.create_date}`);
        console.log(`     Recovery Model: ${db.recovery_model}`);
        console.log(`     Compatibility Level: ${db.compatibility_level}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No user databases found');
    }
    
    // Check if our target database exists
    const targetDb = process.env.DB_DATABASE;
    const targetExists = result.recordset.some(db => db.database_name === targetDb);
    
    console.log('\n🎯 Target Database Check:');
    console.log(`   Configured Database: ${targetDb}`);
    console.log(`   Exists on Server: ${targetExists ? '✅ Yes' : '❌ No'}`);
    
    if (!targetExists) {
      console.log('\n💡 Available alternatives:');
      userDbs.forEach(db => {
        console.log(`   - ${db.database_name}`);
      });
      
      // Check for common variations
      const variations = ['AI_Phone', 'Kimiya_Voice', 'KimiyaVoice', 'AI-Phone'];
      const foundVariations = variations.filter(variation => 
        result.recordset.some(db => db.database_name === variation)
      );
      
      if (foundVariations.length > 0) {
        console.log('\n🔍 Found similar database names:');
        foundVariations.forEach(variation => {
          console.log(`   - ${variation}`);
        });
      }
    }
    
    await pool.close();
    console.log('\n🔌 Connection closed');
    
    return result.recordset;
    
  } catch (error) {
    console.error('\n❌ Failed to list databases:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ELOGIN') {
      console.log('\n🔧 Login failed. Possible issues:');
      console.log('   - Incorrect username or password');
      console.log('   - User does not have permission to access master database');
      console.log('   - SQL Server authentication not enabled');
      console.log('   - User account may be locked or disabled');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n🔧 Server not found. Possible issues:');
      console.log('   - Incorrect server name');
      console.log('   - Network connectivity issues');
      console.log('   - Firewall blocking connection');
    }
    
    return [];
  }
}

/**
 * Try to connect to the configured database and list its tables
 */
async function inspectConfiguredDatabase() {
  console.log('\n🔍 Inspecting Configured Database');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Database: ${configuredDbConfig.database}`);
  
  try {
    console.log('\n⏳ Connecting to configured database...');
    const pool = await sql.connect(configuredDbConfig);
    console.log('✅ Connected successfully!');
    
    // Get database info
    const dbInfo = await pool.request().query(`
      SELECT 
        DB_NAME() as current_database,
        USER_NAME() as current_user,
        GETDATE() as current_time
    `);
    
    const info = dbInfo.recordset[0];
    console.log(`\n🎯 Current Database: ${info.current_database}`);
    console.log(`👤 Current User: ${info.current_user}`);
    console.log(`⏰ Current Time: ${info.current_time}`);
    
    // List tables
    const tablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE,
        CASE 
          WHEN TABLE_NAME LIKE 'tbl%' THEN '✅ Follows naming convention'
          ELSE '⚠️  Does not follow naming convention'
        END as naming_status
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    if (tablesResult.recordset.length > 0) {
      console.log(`\n📋 Found ${tablesResult.recordset.length} table(s):`);
      tablesResult.recordset.forEach(table => {
        console.log(`   📊 ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
        console.log(`      ${table.naming_status}`);
      });
      
      const conventionCompliant = tablesResult.recordset.filter(t => t.TABLE_NAME.startsWith('tbl')).length;
      console.log(`\n📊 Naming Convention Summary:`);
      console.log(`   ✅ Compliant: ${conventionCompliant}/${tablesResult.recordset.length}`);
      console.log(`   ⚠️  Non-compliant: ${tablesResult.recordset.length - conventionCompliant}/${tablesResult.recordset.length}`);
    } else {
      console.log('\n⚠️  No tables found in database');
    }
    
    await pool.close();
    console.log('\n🔌 Connection closed');
    
    return tablesResult.recordset;
    
  } catch (error) {
    console.error('\n❌ Failed to inspect configured database:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.message.includes('Cannot open database')) {
      console.log('\n💡 The configured database does not exist or is not accessible');
      console.log('   Consider updating DB_DATABASE environment variable');
    }
    
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Database Discovery and Inspection Tool');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════');
  
  // First, try to list all databases
  const databases = await listAllDatabases();
  
  // Then try to inspect the configured database
  if (databases.length > 0) {
    await inspectConfiguredDatabase();
  }
  
  console.log('\n🎉 Database discovery completed!');
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  listAllDatabases,
  inspectConfiguredDatabase
};
