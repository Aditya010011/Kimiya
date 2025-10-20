/**
 * Update Credit Plans Schema to Support Annual Billing
 * 
 * This script adds new columns to tblCreditPlans and tblSubscriptions
 * to support annual billing cycles with 20% discount
 */

const sql = require('mssql');
const databaseService = require('./services/database');

async function updateCreditPlansSchema() {
  console.log('🔄 Updating Credit Plans Schema for Annual Billing...\n');

  try {
    const pool = await databaseService.getPool();

    // Step 1: Add new columns to tblCreditPlans
    console.log('1️⃣ Adding new columns to tblCreditPlans...');
    
    await pool.request().query(`
      -- Add annual_price_usd column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'annual_price_usd'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD annual_price_usd DECIMAL(10,2) NULL;
        
        PRINT '✅ Added annual_price_usd column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ annual_price_usd column already exists';
      END
    `);

    await pool.request().query(`
      -- Add billing_cycle column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'billing_cycle'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD billing_cycle NVARCHAR(20) NULL DEFAULT 'monthly';
        
        PRINT '✅ Added billing_cycle column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ billing_cycle column already exists';
      END
    `);

    await pool.request().query(`
      -- Add minutes_included column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'minutes_included'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD minutes_included INT NULL;
        
        PRINT '✅ Added minutes_included column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ minutes_included column already exists';
      END
    `);

    await pool.request().query(`
      -- Add cost_per_minute column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'cost_per_minute'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD cost_per_minute DECIMAL(10,4) NULL;
        
        PRINT '✅ Added cost_per_minute column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ cost_per_minute column already exists';
      END
    `);

    await pool.request().query(`
      -- Add extra_credit_cost column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'extra_credit_cost'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD extra_credit_cost DECIMAL(10,6) NULL;
        
        PRINT '✅ Added extra_credit_cost column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ extra_credit_cost column already exists';
      END
    `);

    await pool.request().query(`
      -- Add is_enterprise column if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblCreditPlans') 
        AND name = 'is_enterprise'
      )
      BEGIN
        ALTER TABLE tblCreditPlans
        ADD is_enterprise BIT NOT NULL DEFAULT 0;
        
        PRINT '✅ Added is_enterprise column';
      END
      ELSE
      BEGIN
        PRINT '⚠️ is_enterprise column already exists';
      END
    `);

    console.log('\n2️⃣ Adding billing_cycle column to tblSubscriptions...');
    
    await pool.request().query(`
      -- Add billing_cycle to subscriptions if it doesn't exist
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('tblSubscriptions') 
        AND name = 'billing_cycle'
      )
      BEGIN
        ALTER TABLE tblSubscriptions
        ADD billing_cycle NVARCHAR(20) NULL DEFAULT 'monthly';
        
        PRINT '✅ Added billing_cycle column to tblSubscriptions';
      END
      ELSE
      BEGIN
        PRINT '⚠️ billing_cycle column already exists in tblSubscriptions';
      END
    `);

    // Step 2: Update existing plans with new pricing structure
    console.log('\n3️⃣ Updating existing credit plans with new pricing...');

    // Delete old plans
    await pool.request().query(`
      DELETE FROM tblCreditPlans WHERE id IN ('basic', 'professional', 'enterprise', 'ultimate');
      PRINT '🗑️ Removed old credit plans';
    `);

    // Insert new plans with competitive pricing
    await pool.request().query(`
      -- Starter Plan
      INSERT INTO tblCreditPlans (
        id, name, description, monthly_credits, price_usd, annual_price_usd,
        billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
        ai_messages, team_members, extra_minute_cost, extra_credit_cost,
        minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
      ) VALUES (
        'starter', 'Starter', '500 mins / month (30,000 credits)',
        30000, 49.00, 470.40, 'monthly',
        2, 5, 5, 2000, 3, 0.40, 0.0067,
        500, 0.098, 0, 0, 1
      );

      -- Professional Plan (Most Popular)
      INSERT INTO tblCreditPlans (
        id, name, description, monthly_credits, price_usd, annual_price_usd,
        billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
        ai_messages, team_members, extra_minute_cost, extra_credit_cost,
        minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
      ) VALUES (
        'professional', 'Professional', '3,000 mins / month (180,000 credits)',
        180000, 299.00, 2868.80, 'monthly',
        10, 25, 50, 10000, 15, 0.25, 0.0042,
        3000, 0.0997, 1, 0, 1
      );

      -- Business Plan
      INSERT INTO tblCreditPlans (
        id, name, description, monthly_credits, price_usd, annual_price_usd,
        billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
        ai_messages, team_members, extra_minute_cost, extra_credit_cost,
        minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
      ) VALUES (
        'business', 'Business', '12,000 mins / month (720,000 credits)',
        720000, 899.00, 8630.40, 'monthly',
        50, 100, -1, 50000, 50, 0.15, 0.0025,
        12000, 0.0749, 0, 0, 1
      );

      -- Enterprise Plan
      INSERT INTO tblCreditPlans (
        id, name, description, monthly_credits, price_usd, annual_price_usd,
        billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
        ai_messages, team_members, extra_minute_cost, extra_credit_cost,
        minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
      ) VALUES (
        'enterprise', 'Enterprise', 'Unlimited minutes (Custom pricing)',
        -1, -1, -1, 'custom',
        -1, -1, -1, -1, -1, 0, 0,
        -1, 0, 0, 1, 1
      );

      PRINT '✅ Inserted new credit plans with competitive pricing';
    `);

    console.log('\n✅ Schema update completed successfully!');
    console.log('\n📊 New Pricing Structure:');
    console.log('   • Starter: $49/month (500 mins) - $470.40/year');
    console.log('   • Professional: $299/month (3,000 mins) - $2,868.80/year ⭐');
    console.log('   • Business: $899/month (12,000 mins) - $8,630.40/year');
    console.log('   • Enterprise: Custom pricing (Unlimited)');
    console.log('\n💰 Annual billing saves 20% on all plans!');

  } catch (error) {
    console.error('❌ Schema update failed:', error.message);
    throw error;
  }
}

// Run the update
updateCreditPlansSchema()
  .then(() => {
    console.log('\n🎉 Credit plans schema updated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to update schema:', error);
    process.exit(1);
  });
