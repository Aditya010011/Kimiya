const sql = require('mssql');
require('dotenv').config({ path: './.env.development' });

// Connect to master database first
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
    requestTimeout: 30000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function checkDatabases() {
  console.log('🔍 Simple Database Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔌 Server: ${masterConfig.server}`);
  console.log(`👤 User: ${masterConfig.user}`);
  
  try {
    console.log('\n⏳ Connecting to master database...');
    const pool = await sql.connect(masterConfig);
    console.log('✅ Connected successfully!');
    
    // Simple server info
    console.log('\n🖥️  Server Information:');
    const serverInfo = await pool.request().query('SELECT @@SERVERNAME as server_name, @@VERSION as version_info');
    console.log(`   Server: ${serverInfo.recordset[0].server_name}`);
    console.log(`   Version: ${serverInfo.recordset[0].version_info.split('\n')[0]}`);
    
    // List all databases
    console.log('\n📊 All Databases:');
    const dbResult = await pool.request().query(`
      SELECT name, database_id, create_date, state_desc 
      FROM sys.databases 
      ORDER BY name
    `);
    
    console.log(`Found ${dbResult.recordset.length} databases:`);
    
    const systemDbs = ['master', 'tempdb', 'model', 'msdb'];
    const userDbs = dbResult.recordset.filter(db => !systemDbs.includes(db.name));
    const systemDbList = dbResult.recordset.filter(db => systemDbs.includes(db.name));
    
    console.log('\n🔧 System Databases:');
    systemDbList.forEach(db => {
      console.log(`   📁 ${db.name} (${db.state_desc})`);
    });
    
    console.log('\n👤 User Databases:');
    if (userDbs.length > 0) {
      userDbs.forEach(db => {
        const isTarget = db.name === process.env.DB_DATABASE;
        const marker = isTarget ? '👉' : '  ';
        console.log(`${marker} 📁 ${db.name} (${db.state_desc}) - Created: ${db.create_date}`);
      });
    } else {
      console.log('   ⚠️  No user databases found');
    }
    
    // Check target database
    const targetDb = process.env.DB_DATABASE;
    const targetExists = dbResult.recordset.some(db => db.name === targetDb);
    
    console.log('\n🎯 Target Database Status:');
    console.log(`   Configured: ${targetDb}`);
    console.log(`   Exists: ${targetExists ? '✅ Yes' : '❌ No'}`);
    
    if (!targetExists) {
      console.log('\n💡 Suggestions:');
      if (userDbs.length > 0) {
        console.log('   Available user databases:');
        userDbs.forEach(db => console.log(`     - ${db.name}`));
      }
      
      // Check for similar names
      const similarDbs = userDbs.filter(db => 
        db.name.toLowerCase().includes('ai') || 
        db.name.toLowerCase().includes('phone') || 
        db.name.toLowerCase().includes('kimiya') ||
        db.name.toLowerCase().includes('voice')
      );
      
      if (similarDbs.length > 0) {
        console.log('   Similar database names found:');
        similarDbs.forEach(db => console.log(`     - ${db.name}`));
      }
    }
    
    await pool.close();
    console.log('\n🔌 Connection closed');
    
    return { userDbs, targetExists };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Code:', error.code);
    return { userDbs: [], targetExists: false };
  }
}

async function checkTargetDatabaseTables() {
  // Try different database names
  const databasesToTry = [
    process.env.DB_DATABASE,
    'AI_Phone',
    'Kimiya_Voice',
    'KimiyaVoice'
  ].filter(Boolean);
  
  console.log('\n🔍 Checking Tables in Potential Databases:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const dbName of databasesToTry) {
    console.log(`\n📊 Trying database: ${dbName}`);
    
    const config = {
      ...masterConfig,
      database: dbName
    };
    
    try {
      const pool = await sql.connect(config);
      console.log(`✅ Connected to ${dbName}`);
      
      // Get basic info
      const info = await pool.request().query('SELECT DB_NAME() as db_name, USER_NAME() as user_name');
      console.log(`   Current DB: ${info.recordset[0].db_name}`);
      console.log(`   Current User: ${info.recordset[0].user_name}`);
      
      // List tables
      const tables = await pool.request().query(`
        SELECT TABLE_NAME, TABLE_TYPE 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);
      
      if (tables.recordset.length > 0) {
        console.log(`   📋 Found ${tables.recordset.length} tables:`);
        tables.recordset.forEach(table => {
          const hasConvention = table.TABLE_NAME.startsWith('tbl');
          const marker = hasConvention ? '✅' : '⚠️ ';
          console.log(`     ${marker} ${table.TABLE_NAME}`);
        });
        
        const conventionCount = tables.recordset.filter(t => t.TABLE_NAME.startsWith('tbl')).length;
        console.log(`   📊 Naming convention: ${conventionCount}/${tables.recordset.length} tables follow 'tbl' prefix`);
      } else {
        console.log('   📋 No tables found');
      }
      
      await pool.close();
      
    } catch (error) {
      console.log(`   ❌ Cannot access ${dbName}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Database and Table Discovery');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════');
  
  const { userDbs, targetExists } = await checkDatabases();
  
  if (userDbs.length > 0 || targetExists) {
    await checkTargetDatabaseTables();
  }
  
  console.log('\n🎉 Discovery completed!');
  
  // Provide recommendations
  console.log('\n💡 Recommendations:');
  if (!targetExists) {
    console.log('   1. Update DB_DATABASE environment variable to an existing database');
    console.log('   2. Or create the Kimiya_Voice database on the server');
  } else {
    console.log('   1. Target database exists and is accessible');
    console.log('   2. Run table migration if needed: node migrate-table-names.cjs');
  }
}

if (require.main === module) {
  main();
}
