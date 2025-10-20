/**
 * Run Credit Allocation Fix
 * 
 * This script applies the SQL fixes to resolve credit allocation issues:
 * 1. Updates CHECK constraint on service_type
 * 2. Creates tblPlanChangeHistory table
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const databaseService = require('../services/database');

async function runFix() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔧 RUNNING CREDIT ALLOCATION FIX');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  try {
    await databaseService.connect();
    console.log('✅ Connected to database\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'fix-credit-allocation-issue.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split by GO statements and filter out comments/empty lines
    const batches = sqlContent
      .split(/\r?\nGO\r?\n/i)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !batch.startsWith('--'));

    console.log(`Found ${batches.length} SQL batch(es) to execute\n`);

    // Execute the entire script as one batch (since we don't have GO statements)
    console.log('Executing SQL fix...\n');
    
    // Step 1: Drop and recreate CHECK constraint
    console.log('📋 STEP 1: Updating CHECK constraint on service_type...\n');
    
    try {
      await databaseService.query(`
        IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_tblCreditTransactions_service_type')
        BEGIN
          ALTER TABLE tblCreditTransactions DROP CONSTRAINT CK_tblCreditTransactions_service_type;
        END
      `);
      console.log('  ✅ Dropped old CHECK constraint\n');
    } catch (error) {
      console.log('  ℹ️  No existing CHECK constraint to drop\n');
    }

    await databaseService.query(`
      ALTER TABLE tblCreditTransactions ADD CONSTRAINT CK_tblCreditTransactions_service_type 
      CHECK (service_type IN (
        'chat',
        'inbound_call',
        'outbound_call',
        'storage',
        'transcription',
        'ai_service',
        'manual',
        'system',
        'adjustment',
        'plan_upgrade',
        'plan_downgrade',
        'reservation',
        'reservation_refund',
        'credit_expiration',
        'allocation',
        'deduction',
        'refund',
        'purchase',
        'subscription'
      ))
    `);
    console.log('  ✅ Created new CHECK constraint with all required values\n');

    // Step 2: Create tblPlanChangeHistory table
    console.log('📋 STEP 2: Creating tblPlanChangeHistory table...\n');
    
    const tableExists = await databaseService.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tblPlanChangeHistory'
    `);

    if (tableExists.recordset[0].count === 0) {
      await databaseService.query(`
        CREATE TABLE tblPlanChangeHistory (
          id INT IDENTITY(1,1) PRIMARY KEY,
          organization_id NVARCHAR(50) NOT NULL,
          old_plan_id NVARCHAR(50),
          new_plan_id NVARCHAR(50),
          old_billing_cycle NVARCHAR(20),
          new_billing_cycle NVARCHAR(20),
          change_type NVARCHAR(20) CHECK (change_type IN ('upgrade', 'downgrade', 'cycle_change', 'initial')),
          effective_date DATETIME2 DEFAULT GETDATE(),
          proration_amount DECIMAL(10,2),
          credit_adjustment INT,
          users_affected INT,
          changed_by INT,
          reason NVARCHAR(500),
          created_at DATETIME2 DEFAULT GETDATE()
        )
      `);
      console.log('  ✅ Created tblPlanChangeHistory table\n');

      // Create indexes
      await databaseService.query(`
        CREATE INDEX IX_PlanChangeHistory_Organization 
          ON tblPlanChangeHistory(organization_id)
      `);
      
      await databaseService.query(`
        CREATE INDEX IX_PlanChangeHistory_EffectiveDate 
          ON tblPlanChangeHistory(effective_date DESC)
      `);
      
      await databaseService.query(`
        CREATE INDEX IX_PlanChangeHistory_ChangeType 
          ON tblPlanChangeHistory(change_type)
      `);
      
      console.log('  ✅ Created indexes on tblPlanChangeHistory\n');
    } else {
      console.log('  ℹ️  tblPlanChangeHistory table already exists\n');
    }

    // Step 3: Verify fixes
    console.log('📋 STEP 3: Verifying fixes...\n');

    const constraint = await databaseService.query(`
      SELECT definition 
      FROM sys.check_constraints 
      WHERE name = 'CK_tblCreditTransactions_service_type'
    `);

    if (constraint.recordset.length > 0) {
      console.log('  ✅ CHECK constraint exists and is active');
      console.log('  Definition:', constraint.recordset[0].definition.substring(0, 100) + '...\n');
    } else {
      console.log('  ❌ CHECK constraint not found!\n');
    }

    const tableCheck = await databaseService.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tblPlanChangeHistory'
    `);

    if (tableCheck.recordset[0].count > 0) {
      console.log('  ✅ tblPlanChangeHistory table exists\n');
    } else {
      console.log('  ❌ tblPlanChangeHistory table not found!\n');
    }

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ CREDIT ALLOCATION FIXES COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log('Next Steps:');
    console.log('  1. Restart the backend server: pm2 restart kimiya-voice-backend-dev');
    console.log('  2. Try purchasing or changing a plan');
    console.log('  3. Verify credits are allocated correctly');
    console.log('  4. Check PM2 logs for any errors\n');

    await databaseService.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR during fix:', error.message);
    console.error('Stack:', error.stack);
    
    try {
      await databaseService.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Run the fix
runFix();

