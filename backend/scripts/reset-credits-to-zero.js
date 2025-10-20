/**
 * Reset Credit Database to Zero State
 * 
 * This script resets all credit balances to 0 for testing purposes.
 * Use this when you want to test the system from a clean state with no credits.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });
const databaseService = require('../services/database');

async function resetCreditsToZero() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔄 CREDIT DATABASE RESET TO ZERO STATE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  try {
    await databaseService.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Check current state
    console.log('📊 STEP 1: Checking current credit balances...\n');
    
    const currentBalances = await databaseService.query(`
      SELECT
        user_id,
        organization_id,
        current_balance,
        allocated_credits,
        used_credits,
        monthly_allocation,
        monthly_used,
        allocation_reset_date
      FROM tblCreditBalances
      ORDER BY user_id
    `);

    if (currentBalances.recordset.length === 0) {
      console.log('ℹ️  No credit balances found in database\n');
    } else {
      console.log(`Found ${currentBalances.recordset.length} user(s) with credit balances:\n`);
      currentBalances.recordset.forEach(balance => {
        console.log(`  User ${balance.user_id} (Org: ${balance.organization_id}):`);
        console.log(`    Current Balance: ${balance.current_balance}`);
        console.log(`    Allocated Credits: ${balance.allocated_credits}`);
        console.log(`    Used Credits: ${balance.used_credits}`);
        console.log(`    Monthly Allocation: ${balance.monthly_allocation}`);
        console.log(`    Monthly Used: ${balance.monthly_used}`);
        console.log(`    Last Reset: ${balance.allocation_reset_date || 'Never'}`);
        console.log('');
      });
    }

    // Step 2: Check transaction count
    console.log('📊 STEP 2: Checking credit transaction history...\n');
    
    const transactionCount = await databaseService.query(`
      SELECT COUNT(*) as count FROM tblCreditTransactions
    `);

    console.log(`Found ${transactionCount.recordset[0].count} transaction(s) in history\n`);

    // Step 3: Reset all balances to 0
    console.log('🔄 STEP 3: Resetting all credit balances to 0...\n');

    const resetResult = await databaseService.query(`
      UPDATE tblCreditBalances
      SET
        current_balance = 0,
        allocated_credits = 0,
        used_credits = 0,
        monthly_allocation = 0,
        monthly_used = 0,
        allocation_reset_date = '1970-01-01',
        last_updated = GETDATE()
    `);

    console.log(`✅ Reset ${resetResult.rowsAffected[0]} credit balance record(s)\n`);

    // Step 4: Optionally clear transaction history
    console.log('🗑️  STEP 4: Clearing credit transaction history...\n');
    
    const clearTransactions = await databaseService.query(`
      DELETE FROM tblCreditTransactions
    `);

    console.log(`✅ Cleared ${clearTransactions.rowsAffected[0]} transaction record(s)\n`);

    // Step 5: Verify reset
    console.log('✅ STEP 5: Verifying reset...\n');
    
    const verifyBalances = await databaseService.query(`
      SELECT
        COUNT(*) as total_users,
        SUM(current_balance) as total_balance,
        SUM(allocated_credits) as total_allocated,
        SUM(used_credits) as total_used,
        SUM(monthly_allocation) as total_monthly_allocation,
        SUM(monthly_used) as total_monthly_used
      FROM tblCreditBalances
    `);

    const verify = verifyBalances.recordset[0];
    console.log('Verification Results:');
    console.log(`  Total Users: ${verify.total_users}`);
    console.log(`  Total Balance: ${verify.total_balance || 0}`);
    console.log(`  Total Allocated: ${verify.total_allocated || 0}`);
    console.log(`  Total Used: ${verify.total_used || 0}`);
    console.log(`  Total Monthly Allocation: ${verify.total_monthly_allocation || 0}`);
    console.log(`  Total Monthly Used: ${verify.total_monthly_used || 0}`);
    console.log('');

    const allZero = (
      (verify.total_balance || 0) === 0 &&
      (verify.total_allocated || 0) === 0 &&
      (verify.total_used || 0) === 0 &&
      (verify.total_monthly_allocation || 0) === 0 &&
      (verify.total_monthly_used || 0) === 0
    );

    if (allZero) {
      console.log('✅ SUCCESS: All credit balances reset to 0\n');
    } else {
      console.log('⚠️  WARNING: Some balances may not be zero\n');
    }

    // Step 6: Check subscriptions
    console.log('📊 STEP 6: Checking active subscriptions...\n');
    
    const subscriptions = await databaseService.query(`
      SELECT 
        organization_id,
        plan_id,
        status,
        billing_cycle,
        current_period_start,
        current_period_end
      FROM tblSubscriptions
      WHERE status = 'active'
    `);

    if (subscriptions.recordset.length === 0) {
      console.log('✅ No active subscriptions found (clean state for testing)\n');
    } else {
      console.log(`⚠️  Found ${subscriptions.recordset.length} active subscription(s):\n`);
      subscriptions.recordset.forEach(sub => {
        console.log(`  Organization: ${sub.organization_id}`);
        console.log(`    Plan: ${sub.plan_id}`);
        console.log(`    Status: ${sub.status}`);
        console.log(`    Billing Cycle: ${sub.billing_cycle}`);
        console.log('');
      });
      console.log('ℹ️  Note: You may want to cancel these subscriptions for a clean test\n');
    }

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 CREDIT DATABASE RESET COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log('✅ All credit balances have been reset to 0');
    console.log('✅ Transaction history has been cleared');
    console.log('✅ System is ready for testing from a clean state\n');
    console.log('Next Steps:');
    console.log('  1. Purchase a plan to allocate credits');
    console.log('  2. Test credit deduction');
    console.log('  3. Test plan changes');
    console.log('  4. Test monthly reset\n');

    await databaseService.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR during reset:', error.message);
    console.error('Stack:', error.stack);
    
    try {
      await databaseService.close();
    } catch (closeError) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

// Run the reset
resetCreditsToZero();

