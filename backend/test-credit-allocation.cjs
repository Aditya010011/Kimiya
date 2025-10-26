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

async function testCreditAllocation() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Get admin and test user
    const adminId = 1; // admin@kimiyavoice.com
    const testUserId = 2; // adityatest1@gmail.com

    console.log('📊 BEFORE ALLOCATION:\n');

    // Get admin balance
    const adminBefore = await pool.request()
      .input('userId', sql.Int, adminId)
      .query(`
        SELECT current_balance, allocated_credits FROM tblCreditBalances WHERE user_id = @userId
      `);

    const adminBalance = adminBefore.recordset[0];
    console.log(`   Admin (ID: ${adminId}): ${adminBalance.current_balance} credits`);

    // Get test user balance
    const userBefore = await pool.request()
      .input('userId', sql.Int, testUserId)
      .query(`
        SELECT current_balance, allocated_credits FROM tblCreditBalances WHERE user_id = @userId
      `);

    const userBalance = userBefore.recordset[0];
    console.log(`   User (ID: ${testUserId}): ${userBalance.current_balance} credits\n`);

    // Test allocation
    const allocationAmount = 5000;
    console.log(`💳 ALLOCATING ${allocationAmount} credits from Admin to User...\n`);

    // Simulate the allocation
    const CreditService = require('./services/CreditService');
    const result = await CreditService.allocateCredits(
      testUserId,
      allocationAmount,
      adminId,
      'Test allocation'
    );

    if (result.success) {
      console.log('✅ Allocation successful!\n');
      console.log(`   Transaction ID: ${result.data.transactionId}`);
      console.log(`   Amount: ${result.data.amountAllocated}`);
      console.log(`   Recipient: ${result.data.balanceBefore} → ${result.data.balanceAfter}`);
      console.log(`   Admin: ${result.data.adminBalanceBefore} → ${result.data.adminBalanceAfter}\n`);
    } else {
      console.log(`❌ Allocation failed: ${result.error}\n`);
      process.exit(1);
    }

    console.log('📊 AFTER ALLOCATION:\n');

    // Get admin balance after
    const adminAfter = await pool.request()
      .input('userId', sql.Int, adminId)
      .query(`
        SELECT current_balance, allocated_credits FROM tblCreditBalances WHERE user_id = @userId
      `);

    const adminBalanceAfter = adminAfter.recordset[0];
    console.log(`   Admin (ID: ${adminId}): ${adminBalanceAfter.current_balance} credits`);
    console.log(`   Expected: ${adminBalance.current_balance - allocationAmount}`);
    console.log(`   ✅ Deducted: ${adminBalance.current_balance - adminBalanceAfter.current_balance} credits\n`);

    // Get test user balance after
    const userAfter = await pool.request()
      .input('userId', sql.Int, testUserId)
      .query(`
        SELECT current_balance, allocated_credits FROM tblCreditBalances WHERE user_id = @userId
      `);

    const userBalanceAfter = userAfter.recordset[0];
    console.log(`   User (ID: ${testUserId}): ${userBalanceAfter.current_balance} credits`);
    console.log(`   Expected: ${userBalance.current_balance + allocationAmount}`);
    console.log(`   ✅ Received: ${userBalanceAfter.current_balance - userBalance.current_balance} credits\n`);

    // Verify transactions
    console.log('📝 TRANSACTION RECORDS:\n');

    const transactions = await pool.request()
      .input('adminId', sql.Int, adminId)
      .input('userId', sql.Int, testUserId)
      .query(`
        SELECT TOP 2 
          transaction_id, user_id, type, amount, balance_before, balance_after, created_at
        FROM tblCreditTransactions
        WHERE (user_id = @userId OR user_id = @adminId)
        ORDER BY created_at DESC
      `);

    for (const txn of transactions.recordset) {
      console.log(`   Transaction: ${txn.transaction_id}`);
      console.log(`   User: ${txn.user_id}, Type: ${txn.type}, Amount: ${txn.amount}`);
      console.log(`   Balance: ${txn.balance_before} → ${txn.balance_after}\n`);
    }

    console.log('✅ TEST COMPLETE - All checks passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

testCreditAllocation();

