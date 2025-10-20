# Credit System Fix Implementation Guide

**Document Version**: 1.0  
**Date**: 2025-10-17  
**Status**: 🔧 IMPLEMENTATION GUIDE

---

## 📋 Overview

This document provides step-by-step implementation instructions for fixing critical issues in the Kimiya Voice AI credit system. Each fix includes:
- Specific code changes
- File locations
- Testing instructions
- Rollback procedures

---

## 🔴 CRITICAL FIX #1: Plan Change Credit Handling

### Problem
When users change plans, credits are duplicated instead of being adjusted properly.

### Files to Modify
1. `backend/services/BillingService.js`
2. `backend/services/CreditService.js`

### Step 1: Add Credit Adjustment Method

**File**: `backend/services/CreditService.js`

**Add after line 439** (after allocateCredits method):

```javascript
/**
 * Adjust credits (positive or negative)
 * Used for plan changes, refunds, corrections
 * @param {number} userId - User ID
 * @param {number} amount - Amount to adjust (can be negative)
 * @param {number} adminUserId - Admin performing adjustment
 * @param {string} reason - Reason for adjustment
 * @param {string} adjustmentType - Type of adjustment
 * @returns {Promise<Object>} Result of adjustment
 */
static async adjustCredits(userId, amount, adminUserId, reason, adjustmentType = 'manual') {
  try {
    const transaction = await databaseService.beginTransaction();
    
    try {
      // Get current balance with row lock
      const request1 = transaction.request();
      request1.input('userId', userId);
      const balanceResult = await request1.query(`
        SELECT
          current_balance, allocated_credits, used_credits, organization_id
        FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
        WHERE user_id = @userId
      `);

      if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
        await transaction.rollback();
        return {
          success: false,
          error: 'User credit balance not found'
        };
      }

      const balance = balanceResult.recordset[0];
      const newBalance = balance.current_balance + amount;
      
      // Prevent negative balance
      if (newBalance < 0) {
        await transaction.rollback();
        return {
          success: false,
          error: 'Adjustment would result in negative balance',
          currentBalance: balance.current_balance,
          adjustmentAmount: amount,
          shortfall: Math.abs(newBalance)
        };
      }

      // Update allocated_credits only if adding credits
      const newAllocatedCredits = amount > 0 
        ? balance.allocated_credits + amount 
        : balance.allocated_credits;

      // Update credit balance
      const request2 = transaction.request();
      request2.input('userId', userId);
      request2.input('newBalance', newBalance);
      request2.input('newAllocatedCredits', newAllocatedCredits);
      await request2.query(`
        UPDATE tblCreditBalances
        SET
          current_balance = @newBalance,
          allocated_credits = @newAllocatedCredits,
          last_updated = GETDATE()
        WHERE user_id = @userId
      `);

      // Create transaction record
      const transactionId = `adj_${Date.now()}_${userId}`;
      const request3 = transaction.request();
      request3.input('transactionId', transactionId);
      request3.input('userId', userId);
      request3.input('organizationId', balance.organization_id);
      request3.input('type', amount > 0 ? 'credit' : 'adjustment');
      request3.input('amount', Math.abs(amount));
      request3.input('balanceBefore', balance.current_balance);
      request3.input('balanceAfter', newBalance);
      request3.input('serviceType', adjustmentType);
      request3.input('adminUserId', adminUserId);
      request3.input('notes', reason);
      await request3.query(`
        INSERT INTO tblCreditTransactions (
          transaction_id, user_id, organization_id, type, amount,
          balance_before, balance_after, service_type,
          reference_type, created_by, notes
        ) VALUES (
          @transactionId, @userId, @organizationId, @type, @amount,
          @balanceBefore, @balanceAfter, @serviceType,
          'credit_adjustment', @adminUserId, @notes
        )
      `);

      await transaction.commit();

      return {
        success: true,
        data: {
          transactionId,
          balanceBefore: balance.current_balance,
          balanceAfter: newBalance,
          amountAdjusted: amount,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error adjusting credits:', error);
    return {
      success: false,
      error: 'Failed to adjust credits'
    };
  }
}
```

### Step 2: Add Proration Helper Methods

**File**: `backend/services/BillingService.js`

**Add after line 605** (before changePlan method):

```javascript
/**
 * Calculate days remaining in billing period
 */
static calculateDaysRemaining(periodEndDate) {
  const now = new Date();
  const end = new Date(periodEndDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate total days in billing period
 */
static calculateTotalDays(periodStartDate, periodEndDate) {
  const start = new Date(periodStartDate);
  const end = new Date(periodEndDate);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate proration for plan upgrade
 */
static calculateUpgradeProration(oldPlan, newPlan, daysRemaining, totalDays) {
  const prorationFactor = daysRemaining / totalDays;
  
  // Credit calculation
  const creditDifference = newPlan.monthly_credits - oldPlan.monthly_credits;
  const proratedCredits = Math.floor(creditDifference * prorationFactor);
  
  // Cost calculation
  const unusedOldValue = oldPlan.price_usd * prorationFactor;
  const proratedNewCost = newPlan.price_usd * prorationFactor;
  const chargeAmount = proratedNewCost - unusedOldValue;
  
  return {
    creditsToAdd: proratedCredits,
    chargeAmount: Math.max(0, chargeAmount),
    accountCredit: Math.max(0, -chargeAmount),
    prorationFactor
  };
}

/**
 * Calculate proration for plan downgrade
 */
static calculateDowngradeProration(oldPlan, newPlan, currentBalance, daysRemaining, totalDays) {
  const prorationFactor = daysRemaining / totalDays;
  
  // Cost calculation (refund)
  const unusedOldValue = oldPlan.price_usd * prorationFactor;
  const proratedNewCost = newPlan.price_usd * prorationFactor;
  const accountCredit = unusedOldValue - proratedNewCost;
  
  // Credit calculation
  const proratedNewCredits = Math.floor(newPlan.monthly_credits * prorationFactor);
  const excessCredits = Math.max(0, currentBalance - proratedNewCredits);
  
  return {
    newBalance: proratedNewCredits,
    excessCredits: excessCredits,
    accountCredit: Math.max(0, accountCredit),
    prorationFactor
  };
}
```

### Step 3: Rewrite changePlan Method

**File**: `backend/services/BillingService.js`

**Replace lines 606-666** with:

```javascript
/**
 * Change subscription plan with proper credit handling
 */
static async changePlan(organizationId, newPlanId, effectiveDate, billingCycle = 'monthly', userId) {
  try {
    // Validate new plan exists
    const newPlan = await this.getPlanById(newPlanId);
    if (!newPlan) {
      return {
        success: false,
        error: 'Invalid plan ID'
      };
    }

    // Get current subscription
    const subResult = await databaseService.query(`
      SELECT * FROM tblSubscriptions
      WHERE organization_id = @organizationId
    `, { organizationId });

    if (!subResult.recordset || subResult.recordset.length === 0) {
      return {
        success: false,
        error: 'No active subscription found'
      };
    }

    const currentSub = subResult.recordset[0];
    
    // Prevent changing to same plan
    if (currentSub.plan_id === newPlanId && currentSub.billing_cycle === billingCycle) {
      return {
        success: false,
        error: 'Already subscribed to this plan and billing cycle'
      };
    }

    const oldPlan = await this.getPlanById(currentSub.plan_id);

    if (effectiveDate === 'immediate') {
      // Calculate proration
      const daysRemaining = this.calculateDaysRemaining(currentSub.current_period_end);
      const totalDays = this.calculateTotalDays(currentSub.current_period_start, currentSub.current_period_end);
      
      // Get all users in organization
      const usersResult = await databaseService.query(`
        SELECT id FROM tblUsers
        WHERE organization_id = @organizationId AND is_active = 1
      `, { organizationId });

      const users = usersResult.recordset || [];
      const isUpgrade = newPlan.monthly_credits > oldPlan.monthly_credits;

      // Process credit adjustments for each user
      for (const user of users) {
        // Get current balance
        const balanceResult = await CreditService.getUserCreditBalance(user.id);
        
        if (!balanceResult.success) {
          console.error(`Failed to get balance for user ${user.id}`);
          continue;
        }

        const currentBalance = balanceResult.data.currentBalance;

        if (isUpgrade) {
          // UPGRADE: Add prorated credit difference
          const proration = this.calculateUpgradeProration(
            oldPlan, 
            newPlan, 
            daysRemaining, 
            totalDays
          );

          if (proration.creditsToAdd > 0) {
            await CreditService.adjustCredits(
              user.id,
              proration.creditsToAdd,
              userId,
              `Prorated upgrade from ${oldPlan.name} to ${newPlan.name} (${Math.round(proration.prorationFactor * 100)}% of billing period remaining)`,
              'plan_upgrade'
            );
          }

          console.log(`✅ Upgraded user ${user.id}: +${proration.creditsToAdd} credits, charge $${proration.chargeAmount.toFixed(2)}`);

        } else {
          // DOWNGRADE: Handle excess credits
          const proration = this.calculateDowngradeProration(
            oldPlan,
            newPlan,
            currentBalance,
            daysRemaining,
            totalDays
          );

          if (proration.excessCredits > 0) {
            // Forfeit excess credits
            await CreditService.adjustCredits(
              user.id,
              -proration.excessCredits,
              userId,
              `Downgrade adjustment from ${oldPlan.name} to ${newPlan.name} - excess credits forfeited`,
              'plan_downgrade'
            );
          }

          console.log(`✅ Downgraded user ${user.id}: -${proration.excessCredits} excess credits, account credit $${proration.accountCredit.toFixed(2)}`);
        }
      }

      // Update subscription with new billing period
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date();
      
      if (billingCycle === 'annual') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      await databaseService.query(`
        UPDATE tblSubscriptions SET
          plan_id = @newPlanId,
          billing_cycle = @billingCycle,
          current_period_start = @newPeriodStart,
          current_period_end = @newPeriodEnd,
          updated_at = GETDATE()
        WHERE organization_id = @organizationId
      `, { 
        organizationId, 
        newPlanId, 
        billingCycle,
        newPeriodStart,
        newPeriodEnd
      });

      return {
        success: true,
        message: `Plan changed from ${oldPlan.name} to ${newPlan.name}`,
        data: {
          oldPlan: oldPlan.name,
          newPlan: newPlan.name,
          billingCycle,
          effectiveDate: 'immediate',
          usersAffected: users.length
        }
      };

    } else if (effectiveDate === 'next_billing_cycle') {
      // Schedule plan change for next billing date
      await databaseService.query(`
        UPDATE tblSubscriptions SET
          scheduled_plan_id = @newPlanId,
          scheduled_billing_cycle = @billingCycle,
          updated_at = GETDATE()
        WHERE organization_id = @organizationId
      `, { organizationId, newPlanId, billingCycle });

      return {
        success: true,
        message: `Plan change scheduled for next billing cycle`,
        data: {
          oldPlan: oldPlan.name,
          newPlan: newPlan.name,
          billingCycle,
          effectiveDate: currentSub.current_period_end
        }
      };

    } else {
      return {
        success: false,
        error: 'Invalid effective date. Must be "immediate" or "next_billing_cycle"'
      };
    }

  } catch (error) {
    console.error('Error changing plan:', error);
    return {
      success: false,
      error: 'Failed to change plan'
    };
  }
}
```

### Testing Instructions

```javascript
// Test 1: Upgrade Starter → Professional (Mid-Cycle)
const result1 = await BillingService.changePlan(
  'org_123',
  'plan_professional',
  'immediate',
  'monthly',
  1 // admin user ID
);

// Expected:
// - Credits increased by prorated amount
// - Billing period reset
// - Transaction records created

// Test 2: Downgrade Professional → Starter
const result2 = await BillingService.changePlan(
  'org_123',
  'plan_starter',
  'immediate',
  'monthly',
  1
);

// Expected:
// - Excess credits forfeited
// - Balance capped at Starter limit
// - Account credit calculated

// Test 3: Schedule change for next cycle
const result3 = await BillingService.changePlan(
  'org_123',
  'plan_business',
  'next_billing_cycle',
  'monthly',
  1
);

// Expected:
// - scheduled_plan_id updated
// - No immediate credit changes
```

---

## 🔴 CRITICAL FIX #2: Transaction Isolation Level

### Problem
Transactions use default READ COMMITTED isolation, allowing phantom reads and lost updates.

### Files to Modify
1. `backend/services/database.js`
2. `backend/services/CreditService.js`

### Step 1: Update beginTransaction Method

**File**: `backend/services/database.js`

**Replace lines 149-162** with:

```javascript
/**
 * Begin a transaction with specified isolation level
 * @param {string} isolationLevel - Isolation level (default: SERIALIZABLE for credit operations)
 */
async beginTransaction(isolationLevel = sql.ISOLATION_LEVEL.SERIALIZABLE) {
  try {
    if (!this.pool) {
      await this.connect();
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin(isolationLevel);
    return transaction;
  } catch (error) {
    console.error('❌ Failed to begin transaction:', error.message);
    throw error;
  }
}
```

### Step 2: Update Credit Operations

**File**: `backend/services/CreditService.js`

**Update line 138** (in deductCredits):
```javascript
// OLD:
const transaction = await databaseService.beginTransaction();

// NEW:
const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
```

**Update line 351** (in allocateCredits):
```javascript
// OLD:
const transaction = await databaseService.beginTransaction();

// NEW:
const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
```

### Testing Instructions

```javascript
// Test concurrent deductions
async function testConcurrentDeductions() {
  const userId = 1;
  const promises = [];
  
  // Try to deduct 100 credits 10 times simultaneously
  for (let i = 0; i < 10; i++) {
    promises.push(
      CreditService.deductCredits(userId, 100, 'test', {}, null, null)
    );
  }
  
  const results = await Promise.all(promises);
  
  // Count successes
  const successes = results.filter(r => r.success).length;
  console.log(`Successful deductions: ${successes}`);
  
  // Verify final balance
  const balance = await CreditService.getUserCreditBalance(userId);
  console.log(`Final balance: ${balance.data.currentBalance}`);
  
  // Expected: Only deductions that fit within balance should succeed
  // No negative balance should occur
}
```

---

## 🔴 CRITICAL FIX #3: Credit Check Race Condition

### Problem
Credit check and deduction are separate operations, allowing race conditions.

### Files to Modify
1. `backend/middleware/creditMiddleware.js`

### Solution: Implement Credit Reservation

**File**: `backend/middleware/creditMiddleware.js`

**Replace entire file** with improved version that reserves credits:

```javascript
const CreditService = require('../services/CreditService');

/**
 * Middleware to check if user has sufficient credits before processing request
 * This version RESERVES credits to prevent race conditions
 */
function requireCredits(requiredCredits = 1) {
  return async (req, res, next) => {
    try {
      // Skip credit check if user is not authenticated (backward compatibility)
      if (!req.user || !req.user.id) {
        console.log('⚠️  CREDITS: No authenticated user, skipping credit check');
        return next();
      }

      const userId = req.user.id;
      
      console.log(`💳 CREDITS: Checking ${requiredCredits} credits for user ${userId}`);

      // Get current balance
      const balanceResult = await CreditService.getUserCreditBalance(userId);

      if (!balanceResult.success) {
        console.error(`❌ CREDITS: Failed to get balance for user ${userId}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to check credit balance'
        });
      }

      const currentBalance = balanceResult.data.currentBalance;

      // Check if user has sufficient credits
      if (currentBalance < requiredCredits) {
        console.log(`❌ CREDITS: Insufficient credits for user ${userId}. Required: ${requiredCredits}, Available: ${currentBalance}`);
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          required: requiredCredits,
          available: currentBalance,
          shortfall: requiredCredits - currentBalance
        });
      }

      // IMMEDIATELY reserve credits (pessimistic locking)
      const reserveResult = await CreditService.deductCredits(
        userId,
        requiredCredits,
        'reservation',
        { reserved: true },
        null,
        'credit_reservation'
      );

      if (!reserveResult.success) {
        console.error(`❌ CREDITS: Failed to reserve credits for user ${userId}`);
        return res.status(402).json({
          success: false,
          error: 'Failed to reserve credits'
        });
      }

      console.log(`✅ CREDITS: Reserved ${requiredCredits} credits for user ${userId}`);

      // Store reservation info for later
      req.creditInfo = {
        requiredCredits,
        userId,
        reservationId: reserveResult.data.transactionId,
        reserved: true
      };

      // On response, handle reservation based on success/failure
      const originalSend = res.send;
      res.send = function(data) {
        // If request succeeded (2xx status), keep the deduction
        // If request failed (4xx, 5xx), refund the reservation
        if (res.statusCode >= 400 && req.creditInfo && req.creditInfo.reserved) {
          // Refund reserved credits
          CreditService.adjustCredits(
            userId,
            requiredCredits,
            userId,
            `Refund for failed operation (status ${res.statusCode})`,
            'reservation_refund'
          ).then(() => {
            console.log(`🔄 CREDITS: Refunded ${requiredCredits} credits to user ${userId} due to failed request`);
          }).catch(err => {
            console.error(`❌ CREDITS: Failed to refund credits:`, err);
          });
        }
        
        originalSend.call(this, data);
      };

      next();

    } catch (error) {
      console.error('Error in requireCredits middleware:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

module.exports = {
  requireCredits
};
```

---

## 📝 Database Schema Updates

### Add Scheduled Plan Change Fields

**File**: Create new migration file `backend/migrations/add-scheduled-plan-fields.sql`

```sql
-- Add fields for scheduled plan changes
ALTER TABLE tblSubscriptions
ADD scheduled_plan_id NVARCHAR(50) NULL,
    scheduled_billing_cycle NVARCHAR(20) NULL;

-- Add comment
EXEC sp_addextendedproperty 
  @name = N'MS_Description', 
  @value = N'Plan ID to switch to at next billing cycle', 
  @level0type = N'SCHEMA', @level0name = N'dbo',
  @level1type = N'TABLE',  @level1name = N'tblSubscriptions',
  @level2type = N'COLUMN', @level2name = N'scheduled_plan_id';
```

---

## ✅ Verification Checklist

After implementing fixes:

- [ ] All tests pass
- [ ] No negative credit balances in database
- [ ] Plan changes properly adjust credits
- [ ] Concurrent operations don't create race conditions
- [ ] Billing periods update correctly
- [ ] Transaction records are created for all operations
- [ ] Proration calculations are accurate
- [ ] Refunds/credits are calculated correctly

---

**Implementation Priority**: 🔴 IMMEDIATE  
**Estimated Time**: 2-3 days for all critical fixes  
**Testing Time**: 1-2 days

