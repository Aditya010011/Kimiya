#!/usr/bin/env node

/**
 * Create Missing Billing History Records
 * 
 * This script creates billing history records for existing active subscriptions
 * that don't have any billing history yet.
 */

// Load environment variables from backend/.env.development
const path = require('path');
const envPath = path.join(__dirname, '.env.development');
require('dotenv').config({ path: envPath });
const sql = require('mssql');

console.log(`Loading environment from: ${envPath}`);

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function createMissingBillingHistory() {
  let pool;

  try {
    console.log('\n🔧 Creating Missing Billing History Records\n');
    console.log('='.repeat(60));

    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    // Find active subscriptions without billing history
    const subscriptionsResult = await pool.request().query(`
      SELECT
        s.id,
        s.organization_id,
        s.plan_id,
        s.current_period_start,
        s.current_period_end,
        s.billing_cycle,
        cp.name as plan_name,
        cp.price_usd,
        cp.annual_price_usd
      FROM tblSubscriptions s
      INNER JOIN tblCreditPlans cp ON s.plan_id = cp.id
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM tblBillingHistory bh
          WHERE bh.subscription_id = s.id
        )
    `);

    const subscriptions = subscriptionsResult.recordset;

    if (subscriptions.length === 0) {
      console.log('✅ All active subscriptions already have billing history records.\n');
      return;
    }

    console.log(`📋 Found ${subscriptions.length} subscriptions without billing history:\n`);

    for (const sub of subscriptions) {
      console.log(`\n📝 Creating billing history for subscription: ${sub.id}`);
      console.log(`   Organization: ${sub.organization_id}`);
      console.log(`   Plan: ${sub.plan_name}`);
      console.log(`   Billing Cycle: ${sub.billing_cycle}`);

      // Determine the amount based on billing cycle
      const amount = sub.billing_cycle === 'annual' ? sub.annual_price_usd : sub.price_usd;
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      try {
        await pool.request()
          .input('organizationId', sql.NVarChar, sub.organization_id)
          .input('subscriptionId', sql.NVarChar, sub.id)
          .input('invoiceNumber', sql.NVarChar, invoiceNumber)
          .input('amountUsd', sql.Decimal(10, 2), amount)
          .input('totalAmount', sql.Decimal(10, 2), amount)
          .input('planName', sql.NVarChar, sub.plan_name)
          .input('planId', sql.NVarChar, sub.plan_id)
          .input('periodStart', sql.DateTime2, sub.current_period_start)
          .input('periodEnd', sql.DateTime2, sub.current_period_end)
          .query(`
            INSERT INTO tblBillingHistory (
              organization_id, subscription_id, invoice_number, amount_usd,
              tax_amount_usd, total_amount_usd, plan_name, plan_id,
              billing_period_start, billing_period_end, status
            ) VALUES (
              @organizationId, @subscriptionId, @invoiceNumber, @amountUsd,
              0, @totalAmount, @planName, @planId,
              @periodStart, @periodEnd, 'paid'
            )
          `);

        console.log(`   ✅ Created billing record: ${invoiceNumber}`);
        console.log(`   Amount: $${amount}`);
        console.log(`   Period: ${sub.current_period_start} to ${sub.current_period_end}`);
      } catch (error) {
        console.error(`   ❌ Failed to create billing record:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Billing history creation complete!\n');

    // Show summary
    const summaryResult = await pool.request().query(`
      SELECT COUNT(*) as total FROM tblBillingHistory
    `);
    console.log(`📊 Total billing history records: ${summaryResult.recordset[0].total}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

createMissingBillingHistory();

