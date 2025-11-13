#!/usr/bin/env node

/**
 * Check Billing History and Webhook Events
 * 
 * This script helps diagnose billing history issues by:
 * 1. Checking if webhook events are being received
 * 2. Checking existing billing history records
 * 3. Checking subscriptions and their Stripe IDs
 * 4. Optionally creating missing billing history records
 */

// Load environment variables from backend/.env.development
const path = require('path');
const envPath = path.join(__dirname, '.env.development');
require('dotenv').config({ path: envPath });
const sql = require('mssql');

console.log(`Loading environment from: ${envPath}`);
console.log(`DB_SERVER: ${process.env.DB_SERVER}`);

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

async function checkBillingHistory() {
  let pool;

  try {
    console.log('\n🔍 Checking Billing History and Webhook Events\n');
    console.log('='.repeat(60));

    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    // 1. Check webhook events
    console.log('📋 Step 1: Checking Webhook Events');
    console.log('-'.repeat(60));
    const webhookResult = await pool.request().query(`
      SELECT TOP 20
        event_id,
        event_type,
        organization_id,
        processed_at
      FROM tblWebhookEvents
      ORDER BY processed_at DESC
    `);

    if (webhookResult.recordset.length > 0) {
      console.log(`✅ Found ${webhookResult.recordset.length} webhook events:\n`);
      webhookResult.recordset.forEach(event => {
        console.log(`   Event: ${event.event_type}`);
        console.log(`   ID: ${event.event_id}`);
        console.log(`   Org: ${event.organization_id}`);
        console.log(`   Processed: ${event.processed_at}`);
        console.log();
      });
    } else {
      console.log('⚠️  No webhook events found in database');
      console.log('   This means webhooks are not being received or processed.\n');
    }

    // 2. Check billing history
    console.log('\n📋 Step 2: Checking Billing History Records');
    console.log('-'.repeat(60));
    const billingResult = await pool.request().query(`
      SELECT
        bh.id,
        bh.invoice_number,
        bh.organization_id,
        bh.plan_name,
        bh.amount_usd,
        bh.status,
        bh.stripe_invoice_id,
        bh.created_at
      FROM tblBillingHistory bh
      ORDER BY bh.created_at DESC
    `);

    if (billingResult.recordset.length > 0) {
      console.log(`✅ Found ${billingResult.recordset.length} billing history records:\n`);
      billingResult.recordset.forEach(record => {
        console.log(`   Invoice: ${record.invoice_number}`);
        console.log(`   Plan: ${record.plan_name}`);
        console.log(`   Amount: $${record.amount_usd}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   Stripe Invoice: ${record.stripe_invoice_id || 'N/A'}`);
        console.log(`   Created: ${record.created_at}`);
        console.log();
      });
    } else {
      console.log('❌ No billing history records found');
      console.log('   This is why the billing history is blank!\n');
    }

    // 3. Check subscriptions
    console.log('\n📋 Step 3: Checking Active Subscriptions');
    console.log('-'.repeat(60));
    const subscriptionResult = await pool.request().query(`
      SELECT
        s.id,
        s.organization_id,
        s.plan_id,
        s.status,
        s.stripe_subscription_id,
        s.stripe_customer_id,
        s.current_period_start,
        s.current_period_end,
        s.billing_cycle,
        cp.name as plan_name,
        cp.price_usd
      FROM tblSubscriptions s
      LEFT JOIN tblCreditPlans cp ON s.plan_id = cp.id
      WHERE s.status = 'active'
      ORDER BY s.updated_at DESC
    `);

    if (subscriptionResult.recordset.length > 0) {
      console.log(`✅ Found ${subscriptionResult.recordset.length} active subscriptions:\n`);
      subscriptionResult.recordset.forEach(sub => {
        console.log(`   Subscription ID: ${sub.id}`);
        console.log(`   Organization: ${sub.organization_id}`);
        console.log(`   Plan: ${sub.plan_name} (${sub.plan_id})`);
        console.log(`   Price: $${sub.price_usd}`);
        console.log(`   Billing Cycle: ${sub.billing_cycle}`);
        console.log(`   Stripe Subscription: ${sub.stripe_subscription_id || 'N/A'}`);
        console.log(`   Stripe Customer: ${sub.stripe_customer_id || 'N/A'}`);
        console.log(`   Period: ${sub.current_period_start} to ${sub.current_period_end}`);
        console.log();
      });
    } else {
      console.log('⚠️  No active subscriptions found\n');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkBillingHistory();

