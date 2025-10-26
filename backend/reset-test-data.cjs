/**
 * Reset test data for plan change testing
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

async function resetTestData() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log(`\n✅ Connected to database\n`);

    // Reset subscription to starter plan
    console.log(`🔄 Resetting subscription to starter plan...`);
    await pool.request()
      .input('organizationId', 'org_default_123')
      .input('planId', 'starter')
      .query(`
        UPDATE tblSubscriptions
        SET plan_id = @planId, updated_at = GETDATE()
        WHERE organization_id = @organizationId
      `);
    console.log(`✅ Subscription reset to starter plan`);

    // Reset credit balances to 30,000 (starter plan credits)
    console.log(`\n💰 Resetting credit balances to 30,000 (starter plan)...`);
    await pool.request()
      .input('organizationId', 'org_default_123')
      .input('credits', 30000)
      .query(`
        UPDATE tblCreditBalances
        SET current_balance = @credits, allocated_credits = @credits, last_updated = GETDATE()
        WHERE organization_id = @organizationId
      `);
    console.log(`✅ Credit balances reset to 30,000`);

    // Verify
    console.log(`\n📋 Verifying reset data:`);
    const subResult = await pool.request()
      .input('organizationId', 'org_default_123')
      .query(`
        SELECT plan_id FROM tblSubscriptions WHERE organization_id = @organizationId
      `);
    
    const creditsResult = await pool.request()
      .input('organizationId', 'org_default_123')
      .query(`
        SELECT user_id, current_balance FROM tblCreditBalances WHERE organization_id = @organizationId
      `);

    if (subResult.recordset && subResult.recordset.length > 0) {
      console.log(`   Plan: ${subResult.recordset[0].plan_id}`);
    }

    if (creditsResult.recordset && creditsResult.recordset.length > 0) {
      creditsResult.recordset.forEach(row => {
        console.log(`   User ${row.user_id}: ${row.current_balance} credits`);
      });
    }

    console.log(`\n✅ Test data reset complete!\n`);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  } finally {
    await pool.close();
  }
}

resetTestData();

