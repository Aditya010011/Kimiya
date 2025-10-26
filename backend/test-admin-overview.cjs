#!/usr/bin/env node

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

async function testAdminOverview() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Get total users and credits
    const overallStats = await pool.request().query(`
      SELECT
        COUNT(DISTINCT cb.user_id) as total_users,
        SUM(cb.allocated_credits) as total_credits_allocated,
        SUM(cb.used_credits) as total_credits_used,
        SUM(cb.current_balance) as total_credits_remaining,
        COUNT(CASE WHEN cb.current_balance < cb.monthly_allocation * 0.1 THEN 1 END) as users_with_low_balance,
        COUNT(CASE WHEN cb.monthly_used > cb.monthly_allocation * 0.8 THEN 1 END) as users_with_high_usage
      FROM tblCreditBalances cb
    `);

    console.log('📊 Overall Stats:');
    const stats = overallStats.recordset[0];
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Total Credits Allocated: ${stats.total_credits_allocated}`);
    console.log(`   Total Credits Used: ${stats.total_credits_used}`);
    console.log(`   Total Credits Remaining: ${stats.total_credits_remaining}`);
    console.log(`   Users with Low Balance: ${stats.users_with_low_balance}`);
    console.log(`   Users with High Usage: ${stats.users_with_high_usage}\n`);

    // Get top users by usage
    const topUsers = await pool.request().query(`
      SELECT TOP 10
        cb.user_id,
        u.email as user_email,
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as user_name,
        ISNULL(cb.used_credits, 0) as credits_used,
        CAST(
          CASE
            WHEN (SELECT SUM(used_credits) FROM tblCreditBalances) > 0
            THEN CAST(ISNULL(cb.used_credits, 0) AS FLOAT) / (SELECT SUM(used_credits) FROM tblCreditBalances) * 100
            ELSE 0
          END
          AS DECIMAL(5,2)
        ) as percentage_of_total
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      WHERE cb.used_credits > 0
      ORDER BY cb.used_credits DESC
    `);

    console.log('👥 Top Users by Usage:');
    topUsers.recordset.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.user_name} (${user.user_email}): ${user.credits_used} credits (${user.percentage_of_total}%)`);
    });
    console.log();

    // Get usage by service type
    const usageByService = await pool.request().query(`
      SELECT
        service_type,
        SUM(CAST(amount AS BIGINT)) as total_credits
      FROM tblCreditTransactions
      WHERE type = 'debit'
      GROUP BY service_type
    `);

    console.log('🔧 Usage by Service:');
    usageByService.recordset.forEach(row => {
      console.log(`   ${row.service_type || 'unknown'}: ${row.total_credits || 0} credits`);
    });
    console.log();

    // Get recent allocations
    const recentAllocations = await pool.request().query(`
      SELECT TOP 10
        ct.id,
        ct.user_id,
        u.email as user_email,
        u.first_name + ' ' + u.last_name as user_name,
        ct.amount,
        ct.type,
        ct.created_at,
        ct.notes
      FROM tblCreditTransactions ct
      INNER JOIN tblUsers u ON ct.user_id = u.id
      WHERE ct.type = 'allocation'
      ORDER BY ct.created_at DESC
    `);

    console.log('📝 Recent Allocations:');
    recentAllocations.recordset.forEach((alloc, index) => {
      console.log(`   ${index + 1}. ${alloc.user_name} (${alloc.user_email}): ${alloc.amount} credits on ${new Date(alloc.created_at).toLocaleString()}`);
    });
    console.log();

    console.log('✅ All data retrieved successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.close();
  }
}

testAdminOverview();

