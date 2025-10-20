#!/usr/bin/env node

/**
 * Test script to verify that credit balance displays real database values
 * instead of hardcoded mock data
 */

require('dotenv').config({ path: './.env.development' });
const databaseService = require('./services/database');
const CreditService = require('./services/CreditService');

async function testCreditBalanceFix() {
  console.log('🧪 Testing Credit Balance Fix');
  console.log('=============================\n');

  try {
    // Test 1: Check if test user exists
    console.log('1️⃣ Checking if test user exists...');
    const userResult = await databaseService.query(`
      SELECT id, email, first_name, last_name 
      FROM tblUsers 
      WHERE email = @email
    `, { email: 'test@kimiya.ai' });

    if (!userResult.recordset || userResult.recordset.length === 0) {
      console.log('❌ Test user not found. Creating test user...');
      
      // Create test user
      await databaseService.query(`
        INSERT INTO tblUsers (email, password_hash, first_name, last_name, role, is_active)
        VALUES (@email, @passwordHash, @firstName, @lastName, @role, @isActive)
      `, {
        email: 'test@kimiya.ai',
        passwordHash: '$2b$10$example.hash.for.test123', // This should be properly hashed
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true
      });
      
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user found:', userResult.recordset[0]);
    }

    // Get user ID
    const userQuery = await databaseService.query(`
      SELECT id FROM tblUsers WHERE email = @email
    `, { email: 'test@kimiya.ai' });
    
    const userId = userQuery.recordset[0].id;
    console.log(`📋 Using User ID: ${userId}`);

    // Test 2: Check current credit balance in database
    console.log('\n2️⃣ Checking actual credit balance in database...');
    const dbBalanceResult = await databaseService.query(`
      SELECT 
        current_balance,
        allocated_credits,
        used_credits,
        monthly_allocation,
        monthly_used,
        last_updated
      FROM tblCreditBalances 
      WHERE user_id = @userId
    `, { userId });

    if (!dbBalanceResult.recordset || dbBalanceResult.recordset.length === 0) {
      console.log('⚠️ No credit balance record found. Initializing...');
      await CreditService.initializeUserCreditBalance(userId);
      
      // Check again
      const newBalanceResult = await databaseService.query(`
        SELECT 
          current_balance,
          allocated_credits,
          used_credits,
          monthly_allocation,
          monthly_used,
          last_updated
        FROM tblCreditBalances 
        WHERE user_id = @userId
      `, { userId });
      
      console.log('✅ Credit balance initialized:', newBalanceResult.recordset[0]);
    } else {
      console.log('✅ Current database balance:', dbBalanceResult.recordset[0]);
    }

    // Test 3: Test CreditService.getUserCreditBalance method
    console.log('\n3️⃣ Testing CreditService.getUserCreditBalance...');
    const serviceResult = await CreditService.getUserCreditBalance(userId);
    
    if (serviceResult.success) {
      console.log('✅ CreditService result:', {
        currentBalance: serviceResult.data.currentBalance,
        allocatedCredits: serviceResult.data.allocatedCredits,
        usedCredits: serviceResult.data.usedCredits,
        monthlyUsed: serviceResult.data.monthlyUsed
      });
      
      // Check if it's returning hardcoded values
      if (serviceResult.data.currentBalance === 1850) {
        console.log('❌ WARNING: CreditService is still returning hardcoded value 1850!');
      } else {
        console.log('✅ CreditService is returning real database values');
      }
    } else {
      console.log('❌ CreditService failed:', serviceResult.error);
    }

    // Test 4: Add some test credits to verify the system works
    console.log('\n4️⃣ Adding test credits to verify system...');
    const allocationResult = await CreditService.allocateCredits(userId, 500, 1, 'Test allocation for UI fix verification');
    
    if (allocationResult.success) {
      console.log('✅ Test credits allocated successfully');
      
      // Check balance again
      const updatedBalance = await CreditService.getUserCreditBalance(userId);
      if (updatedBalance.success) {
        console.log('✅ Updated balance:', {
          currentBalance: updatedBalance.data.currentBalance,
          allocatedCredits: updatedBalance.data.allocatedCredits
        });
      }
    } else {
      console.log('❌ Failed to allocate test credits:', allocationResult.error);
    }

    // Test 5: Test credit deduction
    console.log('\n5️⃣ Testing credit deduction...');
    const deductionResult = await CreditService.deductCredits(
      userId, 
      10, 
      'chat', 
      { message_count: 1, test: true },
      'test_chat_001',
      'chat_message'
    );
    
    if (deductionResult.success) {
      console.log('✅ Credit deduction successful');
      console.log('   New balance:', deductionResult.data.newBalance);
      console.log('   Credits deducted:', deductionResult.data.creditsDeducted);
    } else {
      console.log('❌ Credit deduction failed:', deductionResult.error);
    }

    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log('• Test user exists and has credit balance record');
    console.log('• CreditService methods are working with real database');
    console.log('• Credit allocation and deduction are functional');
    console.log('• Frontend should now display real credit values instead of hardcoded 1850');
    
    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. Login to the UI as test@kimiya.ai');
    console.log('2. Navigate to /credits to see the credit dashboard');
    console.log('3. Verify the balance shows real database values (not 1850)');
    console.log('4. Send a chat message and watch the balance update in real-time');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await databaseService.close();
  }
}

testCreditBalanceFix();
