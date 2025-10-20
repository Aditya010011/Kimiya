// Load environment from backend directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

const databaseService = require('./services/database');

async function runMigration() {
  console.log('🚀 Starting Credit Plans Migration...');
  console.log('========================================\n');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await databaseService.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Add columns to tblCreditPlans
    console.log('📋 Step 1: Adding new columns to tblCreditPlans...\n');

    const columns = [
      { name: 'annual_price_usd', type: 'DECIMAL(10,2) NULL' },
      { name: 'billing_cycle', type: 'NVARCHAR(20) NULL DEFAULT \'monthly\'' },
      { name: 'minutes_included', type: 'INT NULL' },
      { name: 'cost_per_minute', type: 'DECIMAL(10,4) NULL' },
      { name: 'extra_credit_cost', type: 'DECIMAL(10,6) NULL' },
      { name: 'is_enterprise', type: 'BIT NOT NULL DEFAULT 0' }
    ];

    for (const col of columns) {
      try {
        await databaseService.query(`
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = '${col.name}')
          BEGIN
            ALTER TABLE tblCreditPlans ADD ${col.name} ${col.type};
            PRINT '✅ Added ${col.name} column';
          END
        `);
        console.log(`✅ Column ${col.name} added or already exists`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Column ${col.name} already exists`);
        } else {
          console.error(`❌ Error adding column ${col.name}:`, error.message);
        }
      }
    }

    // Step 2: Add billing_cycle to tblSubscriptions
    console.log('\n📋 Step 2: Adding billing_cycle to tblSubscriptions...\n');
    
    try {
      await databaseService.query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblSubscriptions') AND name = 'billing_cycle')
        BEGIN
          ALTER TABLE tblSubscriptions ADD billing_cycle NVARCHAR(20) NULL DEFAULT 'monthly';
          PRINT '✅ Added billing_cycle column to tblSubscriptions';
        END
      `);
      console.log('✅ Column billing_cycle added to tblSubscriptions or already exists');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Column billing_cycle already exists in tblSubscriptions');
      } else {
        console.error('❌ Error adding billing_cycle to tblSubscriptions:', error.message);
      }
    }

    // Step 3: Delete old plans
    console.log('\n📋 Step 3: Removing old credit plans...\n');
    
    try {
      const deleteResult = await databaseService.query(`
        DELETE FROM tblCreditPlans WHERE id IN ('basic', 'professional', 'enterprise', 'ultimate')
      `);
      console.log(`✅ Removed ${deleteResult.rowsAffected[0]} old credit plan(s)`);
    } catch (error) {
      console.error('❌ Error removing old plans:', error.message);
    }

    // Step 4: Insert new plans
    console.log('\n📋 Step 4: Inserting new competitive pricing plans...\n');

    const plans = [
      {
        id: 'starter',
        name: 'Starter',
        description: '500 mins / month (30,000 credits)',
        monthly_credits: 30000,
        price_usd: 49.00,
        annual_price_usd: 470.40,
        billing_cycle: 'monthly',
        ai_operators: 2,
        concurrent_calls: 5,
        campaigns_per_month: 5,
        ai_messages: 2000,
        team_members: 3,
        extra_minute_cost: 0.40,
        extra_credit_cost: 0.0067,
        minutes_included: 500,
        cost_per_minute: 0.098,
        is_popular: 0,
        is_enterprise: 0
      },
      {
        id: 'professional',
        name: 'Professional',
        description: '3,000 mins / month (180,000 credits)',
        monthly_credits: 180000,
        price_usd: 299.00,
        annual_price_usd: 2868.80,
        billing_cycle: 'monthly',
        ai_operators: 10,
        concurrent_calls: 25,
        campaigns_per_month: 50,
        ai_messages: 10000,
        team_members: 15,
        extra_minute_cost: 0.25,
        extra_credit_cost: 0.0042,
        minutes_included: 3000,
        cost_per_minute: 0.0997,
        is_popular: 1,
        is_enterprise: 0
      },
      {
        id: 'business',
        name: 'Business',
        description: '12,000 mins / month (720,000 credits)',
        monthly_credits: 720000,
        price_usd: 899.00,
        annual_price_usd: 8630.40,
        billing_cycle: 'monthly',
        ai_operators: 50,
        concurrent_calls: 100,
        campaigns_per_month: -1,
        ai_messages: 50000,
        team_members: 50,
        extra_minute_cost: 0.15,
        extra_credit_cost: 0.0025,
        minutes_included: 12000,
        cost_per_minute: 0.0749,
        is_popular: 0,
        is_enterprise: 0
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Unlimited minutes (Custom pricing)',
        monthly_credits: -1,
        price_usd: -1,
        annual_price_usd: -1,
        billing_cycle: 'custom',
        ai_operators: -1,
        concurrent_calls: -1,
        campaigns_per_month: -1,
        ai_messages: -1,
        team_members: -1,
        extra_minute_cost: 0,
        extra_credit_cost: 0,
        minutes_included: -1,
        cost_per_minute: 0,
        is_popular: 0,
        is_enterprise: 1
      }
    ];

    for (const plan of plans) {
      try {
        await databaseService.query(`
          INSERT INTO tblCreditPlans (
            id, name, description, monthly_credits, price_usd, annual_price_usd,
            billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
            ai_messages, team_members, extra_minute_cost, extra_credit_cost,
            minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
          ) VALUES (
            @id, @name, @description, @monthly_credits, @price_usd, @annual_price_usd,
            @billing_cycle, @ai_operators, @concurrent_calls, @campaigns_per_month,
            @ai_messages, @team_members, @extra_minute_cost, @extra_credit_cost,
            @minutes_included, @cost_per_minute, @is_popular, @is_enterprise, 1
          )
        `, plan);
        console.log(`✅ Inserted ${plan.name} plan ($${plan.price_usd === -1 ? 'Custom' : plan.price_usd}/month)`);
      } catch (error) {
        if (error.message.includes('duplicate key') || error.message.includes('PRIMARY KEY')) {
          console.log(`⚠️  ${plan.name} plan already exists`);
        } else {
          console.error(`❌ Error inserting ${plan.name} plan:`, error.message);
        }
      }
    }

    // Step 5: Verify the new plans
    console.log('\n📋 Step 5: Verifying new credit plans...\n');
    
    const plansResult = await databaseService.query(`
      SELECT 
        id, name, price_usd, annual_price_usd, monthly_credits,
        minutes_included, cost_per_minute, is_popular, is_enterprise
      FROM tblCreditPlans 
      WHERE is_active = 1
      ORDER BY 
        CASE WHEN price_usd = -1 THEN 9999 ELSE price_usd END
    `);

    console.log('📊 Active Credit Plans:');
    console.log('========================\n');
    
    plansResult.recordset.forEach(plan => {
      const badge = plan.is_popular ? '⭐' : (plan.is_enterprise ? '🚀' : '  ');
      console.log(`${badge} ${plan.name} (${plan.id})`);
      if (plan.price_usd === -1) {
        console.log(`   Price: Custom`);
      } else {
        console.log(`   Monthly: $${plan.price_usd}/month`);
        if (plan.annual_price_usd && plan.annual_price_usd !== -1) {
          const savings = (plan.price_usd * 12) - plan.annual_price_usd;
          console.log(`   Annual: $${plan.annual_price_usd}/year (Save $${savings.toFixed(2)})`);
        }
      }
      console.log(`   Credits: ${plan.monthly_credits === -1 ? 'Unlimited' : plan.monthly_credits.toLocaleString()}`);
      console.log(`   Minutes: ${plan.minutes_included === -1 ? 'Unlimited' : plan.minutes_included?.toLocaleString() || 'N/A'}`);
      if (plan.cost_per_minute > 0) {
        console.log(`   Cost/min: $${plan.cost_per_minute.toFixed(4)}`);
      }
      console.log('');
    });

    console.log('========================================');
    console.log('🎉 New Pricing Structure Activated!');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Test the new pricing: node test-new-pricing.cjs');
    console.log('2. Restart backend: pm2 restart kimiya-voice-backend-dev');
    console.log('3. Check the pricing page in your browser\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await databaseService.close();
    console.log('📡 Database connection closed');
  }
}

runMigration();

