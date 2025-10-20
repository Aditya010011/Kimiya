#!/usr/bin/env node

/**
 * Test Script for Credit System Fixes
 * 
 * This script tests all the critical fixes implemented:
 * 1. Plan change with proration
 * 2. Transaction isolation
 * 3. Race condition prevention
 * 4. Credit adjustment method
 * 5. Monthly reset functionality
 * 
 * Run: node backend/tests/test-credit-fixes.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

const databaseService = require('../services/database');
const CreditService = require('../services/CreditService');
const BillingService = require('../services/BillingService');
const CreditResetService = require('../services/CreditResetService');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

/**
 * Test 1: Credit Adjustment Method
 */
async function testCreditAdjustment() {
  console.log('\n📋 Test 1: Credit Adjustment Method');
  console.log('─────────────────────────────────────');
  
  try {
    // Get a test user
    const userResult = await databaseService.query(`
      SELECT TOP 1 id FROM tblUsers WHERE is_active = 1
    `);
    
    if (!userResult.recordset || userResult.recordset.length === 0) {
      logTest('Credit Adjustment', false, 'No test user found');
      return;
    }
    
    const userId = userResult.recordset[0].id;
    
    // Get initial balance
    const initialBalance = await CreditService.getUserCreditBalance(userId);
    const startBalance = initialBalance.data.currentBalance;
    
    // Test positive adjustment
    const addResult = await CreditService.adjustCredits(
      userId,
      100,
      1,
      'Test: Adding 100 credits',
      'test'
    );
    
    logTest('Positive Credit Adjustment', addResult.success, 
      `Added 100 credits: ${startBalance} → ${addResult.data?.balanceAfter}`);
    
    // Test negative adjustment
    const subtractResult = await CreditService.adjustCredits(
      userId,
      -50,
      1,
      'Test: Removing 50 credits',
      'test'
    );
    
    logTest('Negative Credit Adjustment', subtractResult.success,
      `Removed 50 credits: ${addResult.data?.balanceAfter} → ${subtractResult.data?.balanceAfter}`);
    
    // Test negative balance prevention
    const hugeDeduction = await CreditService.adjustCredits(
      userId,
      -999999,
      1,
      'Test: Should fail',
      'test'
    );
    
    logTest('Negative Balance Prevention', !hugeDeduction.success,
      `Correctly prevented negative balance: ${hugeDeduction.error}`);
    
    // Restore original balance
    const currentBalance = await CreditService.getUserCreditBalance(userId);
    const diff = startBalance - currentBalance.data.currentBalance;
    if (diff !== 0) {
      await CreditService.adjustCredits(userId, diff, 1, 'Test cleanup', 'test');
    }
    
  } catch (error) {
    logTest('Credit Adjustment', false, `Error: ${error.message}`);
  }
}

/**
 * Test 2: Transaction Isolation
 */
async function testTransactionIsolation() {
  console.log('\n📋 Test 2: Transaction Isolation');
  console.log('─────────────────────────────────────');
  
  try {
    // Get a test user with sufficient credits
    const userResult = await databaseService.query(`
      SELECT TOP 1 cb.user_id, cb.current_balance
      FROM tblCreditBalances cb
      WHERE cb.current_balance >= 1000
    `);
    
    if (!userResult.recordset || userResult.recordset.length === 0) {
      logTest('Transaction Isolation', false, 'No test user with sufficient credits');
      return;
    }
    
    const userId = userResult.recordset[0].user_id;
    const initialBalance = userResult.recordset[0].current_balance;
    
    console.log(`Testing with user ${userId}, initial balance: ${initialBalance}`);
    
    // Attempt concurrent deductions
    const promises = [];
    const deductAmount = 10;
    const concurrentRequests = 5;
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        CreditService.deductCredits(
          userId,
          deductAmount,
          'test_concurrent',
          { testId: i },
          null,
          null
        )
      );
    }
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const expectedDeduction = successCount * deductAmount;
    
    // Check final balance
    const finalBalanceResult = await CreditService.getUserCreditBalance(userId);
    const finalBalance = finalBalanceResult.data.currentBalance;
    const actualDeduction = initialBalance - finalBalance;
    
    const isCorrect = actualDeduction === expectedDeduction;
    
    logTest('Concurrent Deductions', isCorrect,
      `${concurrentRequests} concurrent requests, ${successCount} succeeded. Expected deduction: ${expectedDeduction}, Actual: ${actualDeduction}`);
    
    // Restore credits
    if (actualDeduction > 0) {
      await CreditService.adjustCredits(userId, actualDeduction, 1, 'Test cleanup', 'test');
    }
    
  } catch (error) {
    logTest('Transaction Isolation', false, `Error: ${error.message}`);
  }
}

/**
 * Test 3: Plan Change with Proration
 */
async function testPlanChangeProration() {
  console.log('\n📋 Test 3: Plan Change with Proration');
  console.log('─────────────────────────────────────');
  
  try {
    // Get a test organization with subscription
    const orgResult = await databaseService.query(`
      SELECT TOP 1 
        s.organization_id,
        s.plan_id,
        s.billing_cycle,
        s.current_period_start,
        s.current_period_end
      FROM tblSubscriptions s
      WHERE s.status = 'active'
    `);
    
    if (!orgResult.recordset || orgResult.recordset.length === 0) {
      logTest('Plan Change Proration', false, 'No test organization found');
      return;
    }
    
    const org = orgResult.recordset[0];
    const currentPlanId = org.plan_id;
    
    // Get available plans
    const plansResult = await databaseService.query(`
      SELECT id, name, monthly_credits FROM tblCreditPlans 
      WHERE is_active = 1 AND id != @currentPlanId
      ORDER BY monthly_credits DESC
    `, { currentPlanId });
    
    if (!plansResult.recordset || plansResult.recordset.length === 0) {
      logTest('Plan Change Proration', false, 'No alternative plans found');
      return;
    }
    
    const newPlan = plansResult.recordset[0];
    
    console.log(`Testing plan change: ${currentPlanId} → ${newPlan.id}`);
    
    // Get user balance before change
    const userResult = await databaseService.query(`
      SELECT TOP 1 id FROM tblUsers 
      WHERE organization_id = @orgId AND is_active = 1
    `, { orgId: org.organization_id });
    
    const userId = userResult.recordset[0].id;
    const beforeBalance = await CreditService.getUserCreditBalance(userId);
    
    // Perform plan change
    const changeResult = await BillingService.changePlan(
      org.organization_id,
      newPlan.id,
      'immediate',
      'monthly',
      1
    );
    
    logTest('Plan Change Execution', changeResult.success,
      changeResult.message || changeResult.error);
    
    if (changeResult.success) {
      // Verify credits were adjusted
      const afterBalance = await CreditService.getUserCreditBalance(userId);
      const creditChange = afterBalance.data.currentBalance - beforeBalance.data.currentBalance;
      
      logTest('Credit Adjustment on Plan Change', creditChange !== 0,
        `Credits changed by ${creditChange} (before: ${beforeBalance.data.currentBalance}, after: ${afterBalance.data.currentBalance})`);
      
      // Verify billing period was updated
      const subResult = await databaseService.query(`
        SELECT current_period_start, current_period_end 
        FROM tblSubscriptions 
        WHERE organization_id = @orgId
      `, { orgId: org.organization_id });
      
      const newPeriodStart = new Date(subResult.recordset[0].current_period_start);
      const oldPeriodStart = new Date(org.current_period_start);
      const periodUpdated = newPeriodStart > oldPeriodStart;
      
      logTest('Billing Period Update', periodUpdated,
        `Period updated: ${periodUpdated ? 'Yes' : 'No'}`);
      
      // Change back to original plan
      await BillingService.changePlan(
        org.organization_id,
        currentPlanId,
        'immediate',
        org.billing_cycle,
        1
      );
    }
    
  } catch (error) {
    logTest('Plan Change Proration', false, `Error: ${error.message}`);
  }
}

/**
 * Test 4: Monthly Credit Reset
 */
async function testMonthlyCreditReset() {
  console.log('\n📋 Test 4: Monthly Credit Reset');
  console.log('─────────────────────────────────────');
  
  try {
    // Get upcoming resets info
    const upcomingResult = await CreditResetService.getUpcomingResets();
    
    logTest('Get Upcoming Resets', upcomingResult.success,
      `Found ${upcomingResult.data?.total_resets || 0} upcoming resets`);
    
    // Test manual reset for a user
    const userResult = await databaseService.query(`
      SELECT TOP 1 id FROM tblUsers WHERE is_active = 1
    `);
    
    if (userResult.recordset && userResult.recordset.length > 0) {
      const userId = userResult.recordset[0].id;
      const beforeBalance = await CreditService.getUserCreditBalance(userId);
      
      const resetResult = await CreditResetService.manualResetForUser(userId, 1);
      
      logTest('Manual Credit Reset', resetResult.success,
        resetResult.success ? 'Manual reset successful' : resetResult.error);
      
      if (resetResult.success) {
        const afterBalance = await CreditService.getUserCreditBalance(userId);
        const creditsAdded = afterBalance.data.currentBalance - beforeBalance.data.currentBalance;
        
        logTest('Credits Added on Reset', creditsAdded > 0,
          `Added ${creditsAdded} credits`);
      }
    }
    
  } catch (error) {
    logTest('Monthly Credit Reset', false, `Error: ${error.message}`);
  }
}

/**
 * Test 5: Audit Trail
 */
async function testAuditTrail() {
  console.log('\n📋 Test 5: Audit Trail');
  console.log('─────────────────────────────────────');
  
  try {
    // Check if audit table exists
    const tableCheck = await databaseService.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'tblPlanChangeHistory'
    `);
    
    const tableExists = tableCheck.recordset[0].count > 0;
    
    logTest('Audit Table Exists', tableExists,
      tableExists ? 'tblPlanChangeHistory table found' : 'Table not found - run migration');
    
    if (tableExists) {
      // Get recent plan changes
      const historyResult = await databaseService.query(`
        SELECT TOP 5 * FROM tblPlanChangeHistory 
        ORDER BY created_at DESC
      `);
      
      logTest('Audit Trail Records', true,
        `Found ${historyResult.recordset.length} recent plan changes`);
    }
    
  } catch (error) {
    logTest('Audit Trail', false, `Error: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Credit System Fixes - Test Suite');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await databaseService.connect();
    console.log('✅ Database connected\n');
    
    // Run all tests
    await testCreditAdjustment();
    await testTransactionIsolation();
    await testPlanChangeProration();
    await testMonthlyCreditReset();
    await testAuditTrail();
    
    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Close database
    await databaseService.close();
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    await databaseService.close();
    process.exit(1);
  }
}

// Run tests
runAllTests();

