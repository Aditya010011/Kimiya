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

async function testAllocation() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Check before allocation
    console.log('📊 BEFORE ALLOCATION:');
    let result = await pool.request().query(`
      SELECT 
        cb.user_id,
        u.email,
        cb.current_balance,
        cb.allocated_credits
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      WHERE cb.user_id IN (1, 2)
      ORDER BY cb.user_id
    `);

    result.recordset.forEach(row => {
      console.log(`User ${row.user_id} (${row.email}): Current=${row.current_balance}, Allocated=${row.allocated_credits}`);
    });

    // Get overall stats before
    console.log('\n📈 OVERALL STATS BEFORE:');
    let statsResult = await pool.request().query(`
      SELECT
        SUM(cb.allocated_credits) as total_credits_allocated,
        SUM(cb.current_balance) as total_credits_remaining
      FROM tblCreditBalances cb
    `);
    console.log(`Total Allocated: ${statsResult.recordset[0].total_credits_allocated}`);
    console.log(`Total Remaining: ${statsResult.recordset[0].total_credits_remaining}`);

    // Simulate allocation using CreditService
    console.log('\n🔄 ALLOCATING 100 CREDITS FROM ADMIN (USER 1) TO USER 3...\n');
    
    const CreditService = require('./services/CreditService');
    const allocationResult = await CreditService.allocateCredits(3, 100, 1, 'Test allocation');
    
    if (allocationResult.success) {
      console.log('✅ Allocation successful!\n');
    } else {
      console.log('❌ Allocation failed:', allocationResult.error, '\n');
    }

    // Check after allocation
    console.log('📊 AFTER ALLOCATION:');
    result = await pool.request().query(`
      SELECT 
        cb.user_id,
        u.email,
        cb.current_balance,
        cb.allocated_credits
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      WHERE cb.user_id IN (1, 2, 3)
      ORDER BY cb.user_id
    `);

    result.recordset.forEach(row => {
      console.log(`User ${row.user_id} (${row.email}): Current=${row.current_balance}, Allocated=${row.allocated_credits}`);
    });

    // Get overall stats after
    console.log('\n📈 OVERALL STATS AFTER:');
    statsResult = await pool.request().query(`
      SELECT
        SUM(cb.allocated_credits) as total_credits_allocated,
        SUM(cb.current_balance) as total_credits_remaining
      FROM tblCreditBalances cb
    `);
    console.log(`Total Allocated: ${statsResult.recordset[0].total_credits_allocated}`);
    console.log(`Total Remaining: ${statsResult.recordset[0].total_credits_remaining}`);

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.close();
  }
}

testAllocation();

