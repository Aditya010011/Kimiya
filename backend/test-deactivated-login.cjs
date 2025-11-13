const sql = require('mssql');
const path = require('path');

// Load environment configuration
const envFile = process.env.NODE_ENV === "production"
  ? ""
  : path.join(__dirname, ".env.development");

if (envFile) {
  require("dotenv").config({ path: envFile });
}
require('dotenv').config();

async function testDeactivatedLogin() {
  console.log('🧪 Testing Deactivated Account Login');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let pool;
  
  try {
    // Database configuration
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

    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Database connected successfully\n');

    // Check for test users
    const result = await pool.request().query(`
      SELECT id, email, first_name, last_name, is_active, role
      FROM tblUsers
      WHERE email LIKE '%test%' OR email LIKE '%demo%'
      ORDER BY id
    `);

    console.log(`📊 Found ${result.recordset.length} test/demo users:\n`);
    result.recordset.forEach(user => {
      console.log(`  • ID: ${user.id}, Email: ${user.email}, Active: ${user.is_active}, Role: ${user.role}`);
    });

    // If no test users, show all users
    if (result.recordset.length === 0) {
      console.log('\n⚠️  No test/demo users found. Showing all users:\n');
      const allUsers = await pool.request().query(`
        SELECT id, email, first_name, last_name, is_active, role
        FROM tblUsers
        ORDER BY id
      `);
      
      allUsers.recordset.forEach(user => {
        console.log(`  • ID: ${user.id}, Email: ${user.email}, Active: ${user.is_active}, Role: ${user.role}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

testDeactivatedLogin()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
