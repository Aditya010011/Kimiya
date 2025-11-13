const sql = require('mssql');
const path = require('path');

const envFile = process.env.NODE_ENV === "production" ? "" : path.join(__dirname, ".env.development");
if (envFile) require("dotenv").config({ path: envFile });
require('dotenv').config();

async function testQuery() {
  let pool;
  try {
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
      },
    };

    pool = await sql.connect(config);
    
    console.log('Testing exact query from API...\n');
    
    const result = await pool.request().query(`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM tblUserSessions
      WHERE is_active = 1
        AND expires_at > GETDATE()
        AND last_accessed_at > DATEADD(MINUTE, -30, GETDATE())
    `);
    
    console.log('Result:', result.recordset[0]);
    console.log('Active users:', result.recordset[0]?.active_users);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

testQuery();
