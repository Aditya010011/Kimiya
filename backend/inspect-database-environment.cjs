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

/**
 * Get list of all databases on the server
 */
async function listAllDatabases(pool) {
  try {
    console.log('\n📊 Listing all databases on server...');

    const result = await pool.request().query(`
      SELECT
        name as database_name,
        database_id,
        create_date,
        collation_name,
        state_desc as status,
        recovery_model_desc as recovery_model,
        compatibility_level
      FROM sys.databases
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);

    if (result.recordset.length === 0) {
      console.log('⚠️  No user databases found');
      return [];
    }

    console.log(`✅ Found ${result.recordset.length} user database(s):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    result.recordset.forEach(db => {
      console.log(`📁 ${db.database_name}`);
      console.log(`   ID: ${db.database_id}`);
      console.log(`   Status: ${db.status}`);
      console.log(`   Created: ${db.create_date}`);
      console.log(`   Recovery Model: ${db.recovery_model}`);
      console.log(`   Compatibility Level: ${db.compatibility_level}`);
      console.log(`   Collation: ${db.collation_name}`);
      console.log('');
    });

    return result.recordset;
  } catch (error) {
    console.error('❌ Failed to list databases:', error.message);
    return [];
  }
}

/**
 * Get detailed information about the current database
 */
async function getCurrentDatabaseInfo(pool) {
  try {
    console.log('\n🔍 Current Database Information...');

    const result = await pool.request().query(`
      SELECT
        DB_NAME() as current_database,
        USER_NAME() as current_user,
        SUSER_NAME() as login_name,
        @@VERSION as sql_version,
        GETDATE() as current_time,
        @@SERVERNAME as server_name
    `);

    const info = result.recordset[0];
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎯 Current Database: ${info.current_database}`);
    console.log(`👤 Current User: ${info.current_user}`);
    console.log(`🔐 Login Name: ${info.login_name}`);
    console.log(`🖥️  Server Name: ${info.server_name}`);
    console.log(`⏰ Current Time: ${info.current_time}`);
    console.log(`📋 SQL Version: ${info.sql_version.split('\n')[0]}`);

    return info;
  } catch (error) {
    console.error('❌ Failed to get current database info:', error.message);
    return null;
  }
}

/**
 * Get all tables in the current database
 */
async function listAllTables(pool) {
  try {
    console.log('\n📋 Listing all tables in current database...');

    const result = await pool.request().query(`
      SELECT
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        t.TABLE_TYPE,
        CASE
          WHEN t.TABLE_NAME LIKE 'tbl%' THEN '✅ Follows naming convention'
          ELSE '⚠️  Does not follow naming convention'
        END as naming_convention_status
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `);

    if (result.recordset.length === 0) {
      console.log('⚠️  No tables found in current database');
      return [];
    }

    console.log(`✅ Found ${result.recordset.length} table(s):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    result.recordset.forEach(table => {
      console.log(`📊 ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
      console.log(`   Type: ${table.TABLE_TYPE}`);
      console.log(`   ${table.naming_convention_status}`);
      console.log('');
    });

    return result.recordset;
  } catch (error) {
    console.error('❌ Failed to list tables:', error.message);
    return [];
  }
}

/**
 * Get detailed table information including columns, indexes, and constraints
 */
async function getTableDetails(pool, tableName) {
  try {
    console.log(`\n🔍 Detailed information for table: ${tableName}`);

    // Get columns
    const columnsResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE,
          ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);

    console.log('📊 Columns:');
    columnsResult.recordset.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const precision = col.NUMERIC_PRECISION && col.NUMERIC_SCALE ? `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})` : '';
      const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';

      console.log(`   ${col.ORDINAL_POSITION}. ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length}${precision} ${nullable}${defaultVal}`);
    });

    // Get indexes
    const indexesResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT
          i.name as index_name,
          i.type_desc as index_type,
          i.is_unique,
          i.is_primary_key,
          STRING_AGG(c.name, ', ') as columns
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(@tableName)
        AND i.name IS NOT NULL
        GROUP BY i.name, i.type_desc, i.is_unique, i.is_primary_key
        ORDER BY i.is_primary_key DESC, i.name
      `);

    if (indexesResult.recordset.length > 0) {
      console.log('\n🔑 Indexes:');
      indexesResult.recordset.forEach(idx => {
        const type = idx.is_primary_key ? 'PRIMARY KEY' :
                    idx.is_unique ? 'UNIQUE INDEX' : 'INDEX';
        console.log(`   ${type}: ${idx.index_name} (${idx.columns})`);
      });
    }

    // Get row count
    const countResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`SELECT COUNT(*) as row_count FROM [${tableName}]`);

    console.log(`\n📊 Row Count: ${countResult.recordset[0].row_count}`);

    return {
      columns: columnsResult.recordset,
      indexes: indexesResult.recordset,
      rowCount: countResult.recordset[0].row_count
    };

  } catch (error) {
    console.error(`❌ Failed to get details for table ${tableName}:`, error.message);
    return null;
  }
}

/**
 * Main inspection function
 */
async function inspectDatabaseEnvironment() {
  console.log('🔍 Database Environment Inspection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔌 Server: ${config.server}`);
  console.log(`📊 Target Database: ${config.database}`);
  console.log(`👤 User: ${config.user}`);
  console.log(`🔐 Port: ${config.port}`);
  console.log(`🔒 Encryption: ${config.options.encrypt}`);

  try {
    console.log('\n⏳ Connecting to database server...');
    const pool = await sql.connect(config);
    console.log('✅ Connected successfully!');

    // Get current database info
    const currentDbInfo = await getCurrentDatabaseInfo(pool);

    // List all databases on the server
    const databases = await listAllDatabases(pool);

    // List all tables in current database
    const tables = await listAllTables(pool);

    // Get detailed information for each table
    if (tables.length > 0) {
      console.log('\n🔍 Detailed Table Information:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      for (const table of tables) {
        await getTableDetails(pool, table.TABLE_NAME);
      }
    }

    // Summary
    console.log('\n📊 Environment Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗄️  Total Databases: ${databases.length}`);
    console.log(`📋 Tables in ${currentDbInfo?.current_database || config.database}: ${tables.length}`);

    const conventionCompliant = tables.filter(t => t.TABLE_NAME.startsWith('tbl')).length;
    console.log(`✅ Tables following naming convention: ${conventionCompliant}/${tables.length}`);

    if (conventionCompliant < tables.length) {
      console.log('\n💡 Recommendation: Run migration script to update table naming convention');
      console.log('   Command: node migrate-table-names.cjs');
    }

    // List databases with their status
    if (databases.length > 0) {
      console.log('\n📊 Available Databases:');
      databases.forEach(db => {
        const isCurrent = db.database_name === (currentDbInfo?.current_database || config.database);
        const marker = isCurrent ? '👉' : '  ';
        console.log(`${marker} ${db.database_name} (${db.status})`);
      });
    }

    await pool.close();
    console.log('\n🔌 Database connection closed');
    console.log('\n🎉 Database environment inspection completed!');

  } catch (error) {
    console.error('\n❌ Database inspection failed:');
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

    // Provide troubleshooting suggestions
    console.log('\n🔧 Troubleshooting Suggestions:');
    if (error.code === 'ELOGIN') {
      console.log('   - Check database credentials (DB_USER, DB_PASSWORD)');
      console.log('   - Verify user has access to the database');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   - Check database server name (DB_SERVER)');
      console.log('   - Verify network connectivity');
    } else if (error.code === 'ETIMEOUT') {
      console.log('   - Check firewall settings');
      console.log('   - Verify database server is running');
    } else if (error.message.includes('database')) {
      console.log('   - Check database name (DB_DATABASE)');
      console.log('   - Verify database exists on the server');
    }

    process.exit(1);
  }
}

// Run inspection if this file is executed directly
if (require.main === module) {
  inspectDatabaseEnvironment();
}

module.exports = {
  inspectDatabaseEnvironment,
  listAllDatabases,
  getCurrentDatabaseInfo,
  listAllTables,
  getTableDetails
};