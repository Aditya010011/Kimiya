/**
 * Check current subscription in database
 */

require('dotenv').config({ path: './backend/.env.development' });
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

async function checkSubscription() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log(`\n✅ Connected to database\n`);

    // Check subscription
    const result = await pool.request()
      .input('organizationId', 'org_default_123')
      .query(`
        SELECT id, organization_id, plan_id, status, created_at, updated_at
        FROM tblSubscriptions
        WHERE organization_id = @organizationId
      `);

    if (result.recordset && result.recordset.length > 0) {
      const sub = result.recordset[0];
      console.log(`📋 Current Subscription:`);
      console.log(`   ID: ${sub.id}`);
      console.log(`   Organization: ${sub.organization_id}`);
      console.log(`   Plan: ${sub.plan_id}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Created: ${sub.created_at}`);
      console.log(`   Updated: ${sub.updated_at}`);
    } else {
      console.log(`❌ No subscription found for org_default_123`);
    }

    // Check credit balances
    console.log(`\n💰 Credit Balances:`);
    const creditsResult = await pool.request()
      .input('organizationId', 'org_default_123')
      .query(`
        SELECT u.id, u.email, cb.current_balance, cb.allocated_credits
        FROM tblUsers u
        LEFT JOIN tblCreditBalances cb ON u.id = cb.user_id
        WHERE u.organization_id = @organizationId
        ORDER BY u.id
      `);

    if (creditsResult.recordset && creditsResult.recordset.length > 0) {
      creditsResult.recordset.forEach(row => {
        console.log(`   User ${row.id} (${row.email}): ${row.current_balance || 0} credits`);
      });
    }

    console.log();
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  } finally {
    await pool.close();
  }
}

checkSubscription();

