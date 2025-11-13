const sql = require('mssql');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function checkSchema() {
  let pool;
  try {
    console.log('🔍 Checking tblUsers schema...\n');
    pool = await sql.connect(config);
    
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblUsers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 tblUsers columns:');
    console.log('─'.repeat(80));
    result.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE.padEnd(15)} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

checkSchema();
