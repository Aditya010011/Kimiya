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

async function checkAllocatedCredits() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connected to database\n');

    // Get all credit balances
    const result = await pool.request().query(`
      SELECT 
        cb.user_id,
        u.email,
        u.first_name + ' ' + u.last_name as name,
        cb.current_balance,
        cb.allocated_credits,
        cb.used_credits,
        cb.monthly_allocation,
        cb.monthly_used
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      ORDER BY cb.user_id
    `);

    console.log('📊 Credit Balances:\n');
    console.log('User ID | Email | Name | Current Balance | Allocated Credits | Used Credits | Monthly Allocation | Monthly Used');
    console.log('--------|-------|------|-----------------|-------------------|--------------|--------------------|-----------');
    
    result.recordset.forEach(row => {
      console.log(`${row.user_id} | ${row.email} | ${row.name} | ${row.current_balance} | ${row.allocated_credits} | ${row.used_credits} | ${row.monthly_allocation} | ${row.monthly_used}`);
    });

    console.log('\n\n📈 Summary:');
    const totalAllocated = result.recordset.reduce((sum, row) => sum + (row.allocated_credits || 0), 0);
    const totalUsed = result.recordset.reduce((sum, row) => sum + (row.used_credits || 0), 0);
    const totalCurrent = result.recordset.reduce((sum, row) => sum + (row.current_balance || 0), 0);
    
    console.log(`Total Allocated Credits: ${totalAllocated}`);
    console.log(`Total Used Credits: ${totalUsed}`);
    console.log(`Total Current Balance: ${totalCurrent}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.close();
  }
}

checkAllocatedCredits();

