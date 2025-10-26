#!/usr/bin/env node

require('dotenv').config({ path: '.env.development' });
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

async function resetCredits() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Get all users except admin
    const usersResult = await pool.request().query(`
      SELECT id, email FROM tblUsers 
      WHERE organization_id = 'org_default_123' 
      AND email != 'admin@kimiyavoice.com'
      ORDER BY id
    `);

    const users = usersResult.recordset || [];
    console.log(`📋 Found ${users.length} non-admin users to reset:\n`);

    for (const user of users) {
      console.log(`   Resetting credits for: ${user.email} (ID: ${user.id})`);

      // Reset credit balance to 0
      await pool.request()
        .input('userId', sql.Int, user.id)
        .query(`
          UPDATE tblCreditBalances
          SET current_balance = 0, allocated_credits = 0, last_updated = GETDATE()
          WHERE user_id = @userId
        `);

      // Record transaction (using 'adjustment' type which is valid)
      await pool.request()
        .input('transactionId', sql.NVarChar, `reset_${Date.now()}_${user.id}`)
        .input('userId', sql.Int, user.id)
        .input('organizationId', sql.NVarChar, 'org_default_123')
        .query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type, notes, created_by, created_at
          ) VALUES (
            @transactionId, @userId, @organizationId, 'adjustment', 1,
            30000, 0, 'system', 'Credits reset for testing', 1, GETDATE()
          )
        `);

      console.log(`   ✅ Reset complete\n`);
    }

    console.log(`\n✅ All non-admin user credits have been reset to 0`);
    console.log(`\n📊 Verifying reset:\n`);

    const verifyResult = await pool.request().query(`
      SELECT 
        u.id, u.email, 
        ISNULL(cb.current_balance, 0) as balance
      FROM tblUsers u
      LEFT JOIN tblCreditBalances cb ON u.id = cb.user_id
      WHERE u.organization_id = 'org_default_123'
      ORDER BY u.id
    `);

    for (const user of verifyResult.recordset) {
      console.log(`   User ${user.id} (${user.email}): ${user.balance} credits`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

resetCredits();

