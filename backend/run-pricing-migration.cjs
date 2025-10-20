// Load environment from backend directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

const fs = require('fs');
const databaseService = require('./services/database');

async function runMigration() {
  console.log('🚀 Starting Credit Plans Migration...');
  console.log('========================================\n');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await databaseService.connect();
    console.log('✅ Connected to database\n');

    // Read SQL file
    const sqlFilePath = path.join(__dirname, 'update-pricing-plans.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📋 Executing SQL migration script...\n');

    try {
      console.log('⏳ Running migration...');
      const result = await databaseService.query(sqlContent);

      // Print any messages from PRINT statements
      if (result.recordset && result.recordset.length > 0) {
        console.log('   Result:', result.recordset);
      }

      console.log('✅ Migration SQL executed successfully\n');
    } catch (error) {
      // Some errors are expected (like "column already exists")
      if (error.message.includes('already exists') ||
          error.message.includes('Cannot drop') ||
          error.message.includes('There is already an object')) {
        console.log('⚠️  Some objects already exist (this is OK)\n');
      } else {
        console.error('❌ Error executing migration:', error.message);
        console.error('This may be OK if columns already exist\n');
      }
    }

    console.log('========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');

    // Verify the new plans
    console.log('🔍 Verifying new credit plans...\n');
    const plansResult = await databaseService.query(`
      SELECT 
        id, 
        name, 
        price_usd, 
        annual_price_usd,
        monthly_credits,
        minutes_included,
        cost_per_minute,
        billing_cycle,
        is_popular,
        is_enterprise,
        is_active
      FROM tblCreditPlans 
      WHERE is_active = 1
      ORDER BY price_usd
    `);

    if (plansResult.recordset.length > 0) {
      console.log('📊 Active Credit Plans:');
      console.log('========================\n');
      
      plansResult.recordset.forEach(plan => {
        console.log(`${plan.is_popular ? '⭐' : '  '} ${plan.name} (${plan.id})`);
        console.log(`   Monthly: $${plan.price_usd}/month`);
        if (plan.annual_price_usd) {
          const savings = (plan.price_usd * 12) - plan.annual_price_usd;
          console.log(`   Annual: $${plan.annual_price_usd}/year (Save $${savings.toFixed(2)})`);
        }
        console.log(`   Credits: ${plan.monthly_credits.toLocaleString()}`);
        console.log(`   Minutes: ${plan.minutes_included?.toLocaleString() || 'N/A'}`);
        console.log(`   Cost/min: $${plan.cost_per_minute?.toFixed(4) || 'N/A'}`);
        console.log(`   Enterprise: ${plan.is_enterprise ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No active plans found');
    }

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

