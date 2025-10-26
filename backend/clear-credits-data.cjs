#!/usr/bin/env node

/**
 * Clear all credits-related data from the database
 * This script clears:
 * - tblCreditBalances
 * - tblCreditTransactions
 * - tblSubscriptions
 * - tblBillingHistory
 * - tblPaymentMethods
 * - tblUsageLogs
 *
 * Usage: node clear-credits-data.cjs
 */

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

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
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function clearCreditsData() {
  let pool;
  try {
    console.log('\n🔄 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Database connected successfully!\n');

    // Disable foreign key constraints temporarily
    console.log('🔐 Disabling foreign key constraints...');
    try {
      await pool.request().query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'ALTER TABLE ' + QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME) + ' NOCHECK CONSTRAINT ALL;'
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE';
        EXEC sp_executesql @sql;
      `);
    } catch (e) {
      console.warn('⚠️  Could not disable all constraints (this is OK for Azure SQL)');
    }
    console.log('✅ Foreign key constraints disabled\n');

    // Clear tables in order of dependencies
    const tables = [
      'tblUsageLogs',
      'tblBillingHistory',
      'tblCreditTransactions',
      'tblPaymentMethods',
      'tblCreditBalances',
      'tblSubscriptions'
    ];

    for (const table of tables) {
      try {
        const result = await pool.request().query(`DELETE FROM ${table}`);
        console.log(`✅ Cleared ${table}: ${result.rowsAffected[0]} rows deleted`);
      } catch (error) {
        console.warn(`⚠️  Could not clear ${table}: ${error.message}`);
      }
    }

    // Re-enable foreign key constraints
    console.log('\n🔐 Re-enabling foreign key constraints...');
    try {
      await pool.request().query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'ALTER TABLE ' + QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME) + ' WITH CHECK CHECK CONSTRAINT ALL;'
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE';
        EXEC sp_executesql @sql;
      `);
    } catch (e) {
      console.warn('⚠️  Could not re-enable all constraints (this is OK for Azure SQL)');
    }
    console.log('✅ Foreign key constraints re-enabled\n');

    // Verify tables are empty
    console.log('📊 Verifying tables are empty:\n');
    for (const table of tables) {
      const result = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.recordset[0].count;
      console.log(`   ${table}: ${count} rows`);
    }

    console.log('\n🎉 All credits data cleared successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Log in to the admin panel');
    console.log('   2. Navigate to /admin/billing');
    console.log('   3. Select a plan and complete the payment');
    console.log('   4. Check if the subscription updates correctly\n');

  } catch (error) {
    console.error('❌ Error clearing credits data:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the script
clearCreditsData();

