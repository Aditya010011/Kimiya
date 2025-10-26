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

async function checkUsage() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Check recent transactions
    console.log('📝 Recent Transactions (Last 20):');
    const txResult = await pool.request().query(`
      SELECT TOP 20
        id, user_id, type, amount, service_type, created_at
      FROM tblCreditTransactions
      ORDER BY created_at DESC
    `);

    if (txResult.recordset.length === 0) {
      console.log('   No transactions found');
    } else {
      txResult.recordset.forEach(row => {
        console.log(`   ${row.type.toUpperCase()}: User ${row.user_id}, Amount: ${row.amount}, Service: ${row.service_type}, Date: ${new Date(row.created_at).toLocaleString()}`);
      });
    }

    // Check credit balances with usage
    console.log('\n📊 Credit Balances with Usage:');
    const balResult = await pool.request().query(`
      SELECT 
        cb.user_id,
        u.email,
        cb.current_balance,
        cb.allocated_credits,
        cb.used_credits,
        cb.monthly_allocation,
        cb.monthly_used
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      ORDER BY cb.user_id
    `);

    balResult.recordset.forEach(row => {
      console.log(`   User ${row.user_id} (${row.email}): Current=${row.current_balance}, Allocated=${row.allocated_credits}, Used=${row.used_credits}, Monthly=${row.monthly_used}/${row.monthly_allocation}`);
    });

    // Check overall stats
    console.log('\n📈 Overall Stats:');
    const statsResult = await pool.request().query(`
      SELECT
        COUNT(DISTINCT cb.user_id) as total_users,
        SUM(cb.allocated_credits) as total_credits_allocated,
        SUM(cb.used_credits) as total_credits_used,
        SUM(cb.current_balance) as total_credits_remaining,
        COUNT(CASE WHEN cb.current_balance < cb.monthly_allocation * 0.1 THEN 1 END) as users_with_low_balance,
        COUNT(CASE WHEN cb.monthly_used > cb.monthly_allocation * 0.8 THEN 1 END) as users_with_high_usage
      FROM tblCreditBalances cb
    `);

    const stats = statsResult.recordset[0];
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Total Allocated: ${stats.total_credits_allocated}`);
    console.log(`   Total Used: ${stats.total_credits_used}`);
    console.log(`   Total Remaining: ${stats.total_credits_remaining}`);
    console.log(`   Users with Low Balance: ${stats.users_with_low_balance}`);
    console.log(`   Users with High Usage: ${stats.users_with_high_usage}`);

    // Check debit transactions
    console.log('\n💳 Debit Transactions (Usage):');
    const debitResult = await pool.request().query(`
      SELECT TOP 20
        id, user_id, amount, service_type, created_at
      FROM tblCreditTransactions
      WHERE type = 'debit'
      ORDER BY created_at DESC
    `);

    if (debitResult.recordset.length === 0) {
      console.log('   No debit transactions found (no usage yet)');
    } else {
      debitResult.recordset.forEach(row => {
        console.log(`   User ${row.user_id}: ${row.amount} credits for ${row.service_type} on ${new Date(row.created_at).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.close();
  }
}

checkUsage();

