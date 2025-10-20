# Credit System Analysis: Issues, Anomalies & Recommendations

**Analysis Date**: 2025-10-17  
**Analyst**: AI Code Review  
**Status**: 🔴 CRITICAL ISSUES FOUND

---

## 📋 Executive Summary

This document provides a comprehensive analysis of the Kimiya Voice AI credit and pricing system, identifying **critical issues**, **security vulnerabilities**, **race conditions**, and **missing functionality** related to plan changes, credit management, and billing operations.

### Severity Levels
- 🔴 **CRITICAL**: System-breaking issues that can cause data loss or financial discrepancies
- 🟠 **HIGH**: Significant issues that affect core functionality
- 🟡 **MEDIUM**: Issues that may cause problems in specific scenarios
- 🟢 **LOW**: Minor issues or improvements

---

## 🚨 CRITICAL ISSUES

### 1. **Plan Change Credit Handling - NO PRORATION OR CREDIT ADJUSTMENT** 🔴

**Location**: `backend/services/BillingService.js:606-666` (changePlan method)

**Issue**: When users change plans (upgrade or downgrade), the system:
1. ✅ Updates the subscription plan_id
2. ✅ Allocates NEW plan credits to all users
3. ❌ **DOES NOT handle existing credits**
4. ❌ **DOES NOT implement proration**
5. ❌ **DOES NOT adjust for mid-cycle changes**

**Current Behavior**:
```javascript
// Line 635-646: changePlan method
if (effectiveDate === 'immediate') {
  await databaseService.query(`
    UPDATE tblSubscriptions SET
      plan_id = @newPlanId,
      billing_cycle = @billingCycle,
      updated_at = GETDATE()
    WHERE organization_id = @organizationId
  `, { organizationId, newPlanId, billingCycle });

  // Allocate credits for new plan
  await this.allocateCreditsForPlan(organizationId, newPlan, userId);
}
```

**Problems**:

#### A. **Upgrade Scenario (Starter → Professional)**
- User has 10,000 unused credits from Starter plan (30,000 total)
- User upgrades to Professional (180,000 credits)
- System allocates 180,000 NEW credits
- **Result**: User now has 190,000 credits (10,000 + 180,000)
- **Expected**: Should either:
  - Forfeit old credits and get 180,000
  - Prorate based on time remaining in billing cycle
  - Carry over with clear policy

#### B. **Downgrade Scenario (Professional → Starter)**
- User has 150,000 unused credits from Professional plan
- User downgrades to Starter (30,000 credits)
- System allocates 30,000 NEW credits
- **Result**: User now has 180,000 credits (150,000 + 30,000)
- **Expected**: Should either:
  - Cap at new plan limit (30,000)
  - Forfeit excess credits
  - Provide refund/credit for unused portion

#### C. **Financial Impact**
- Users can exploit by:
  1. Subscribe to Professional ($299)
  2. Use minimal credits
  3. Downgrade to Starter ($49)
  4. Keep Professional-level credits
  5. **Loss**: $250 + credit value discrepancy

**Severity**: 🔴 **CRITICAL** - Direct financial loss and unfair usage

**Recommendation**:
```javascript
// Proposed solution in changePlan method
static async changePlan(organizationId, newPlanId, effectiveDate, billingCycle = 'monthly', userId) {
  // ... existing validation ...
  
  const currentSub = subResult.recordset[0];
  const oldPlan = await this.getPlanById(currentSub.plan_id);
  
  // Calculate proration
  const daysRemaining = this.calculateDaysRemaining(currentSub.current_period_end);
  const totalDays = this.calculateTotalDays(currentSub.current_period_start, currentSub.current_period_end);
  const prorationFactor = daysRemaining / totalDays;
  
  if (effectiveDate === 'immediate') {
    // Get all users in organization
    const users = await this.getOrganizationUsers(organizationId);
    
    for (const user of users) {
      // Get current balance
      const balance = await CreditService.getUserCreditBalance(user.id);
      
      // Determine credit adjustment strategy
      if (newPlan.monthly_credits > oldPlan.monthly_credits) {
        // UPGRADE: Add prorated difference
        const creditDifference = newPlan.monthly_credits - oldPlan.monthly_credits;
        const proratedCredits = Math.floor(creditDifference * prorationFactor);
        
        await CreditService.allocateCredits(
          user.id,
          proratedCredits,
          userId,
          `Prorated upgrade from ${oldPlan.name} to ${newPlan.name}`
        );
      } else {
        // DOWNGRADE: Handle excess credits
        const excessCredits = balance.data.currentBalance - newPlan.monthly_credits;
        
        if (excessCredits > 0) {
          // Option 1: Forfeit excess (recommended)
          await CreditService.adjustCredits(
            user.id,
            -excessCredits,
            userId,
            `Downgrade adjustment from ${oldPlan.name} to ${newPlan.name}`,
            'plan_downgrade'
          );
          
          // Option 2: Allow grace period (alternative)
          // Mark credits as "expiring" after grace period
        }
      }
    }
    
    // Update subscription
    await databaseService.query(`
      UPDATE tblSubscriptions SET
        plan_id = @newPlanId,
        billing_cycle = @billingCycle,
        updated_at = GETDATE()
      WHERE organization_id = @organizationId
    `, { organizationId, newPlanId, billingCycle });
    
    // Create billing adjustment record
    await this.createProrationBillingRecord(organizationId, oldPlan, newPlan, prorationFactor);
  }
}
```

---

### 2. **Credit Allocation Duplicates on Plan Change** 🔴

**Location**: `backend/services/BillingService.js:332-358` (allocateCreditsForPlan)

**Issue**: The `allocateCreditsForPlan` method ALWAYS adds credits without checking:
1. If credits were already allocated this billing cycle
2. If this is a plan change vs. new subscription
3. If users already have credits from previous plan

**Current Code**:
```javascript
static async allocateCreditsForPlan(organizationId, plan, adminUserId) {
  const users = usersResult.recordset || [];
  
  // Allocate credits to each user
  for (const user of users) {
    const CreditService = require('./CreditService');
    await CreditService.allocateCredits(
      user.id, 
      plan.monthly_credits,  // ← ALWAYS adds full amount
      adminUserId, 
      `Monthly allocation for ${plan.name} plan`
    );
  }
}
```

**Problem**: 
- Called by both `createOrUpdateSubscription` (line 301) and `changePlan` (line 645)
- No check for existing allocations
- No differentiation between new subscription and plan change

**Severity**: 🔴 **CRITICAL** - Credit duplication, financial loss

**Recommendation**:
```javascript
static async allocateCreditsForPlan(organizationId, plan, adminUserId, isNewSubscription = true) {
  const users = usersResult.recordset || [];
  
  for (const user of users) {
    if (isNewSubscription) {
      // New subscription: allocate full credits
      await CreditService.allocateCredits(
        user.id, 
        plan.monthly_credits, 
        adminUserId, 
        `Initial allocation for ${plan.name} plan`
      );
    } else {
      // Plan change: handled separately in changePlan method
      // Do not allocate here
    }
  }
}
```

---

### 3. **No Transaction Isolation Level Set** 🔴

**Location**: `backend/services/database.js:149-162` (beginTransaction)

**Issue**: The transaction begins without specifying isolation level:

```javascript
async beginTransaction() {
  const transaction = new sql.Transaction(this.pool);
  await transaction.begin();  // ← No isolation level specified
  return transaction;
}
```

**Problem**:
- Defaults to SQL Server's READ COMMITTED isolation level
- Can lead to **phantom reads** in credit balance queries
- Concurrent operations may see inconsistent data

**Scenario**:
1. Transaction A reads balance: 1000 credits
2. Transaction B reads balance: 1000 credits
3. Transaction A deducts 100 → balance = 900
4. Transaction B deducts 100 → balance = 900 (should be 800!)
5. **Result**: Lost update, 100 credits "created" from nowhere

**Severity**: 🔴 **CRITICAL** - Data integrity violation, credit creation

**Recommendation**:
```javascript
async beginTransaction(isolationLevel = sql.ISOLATION_LEVEL.SERIALIZABLE) {
  const transaction = new sql.Transaction(this.pool);
  await transaction.begin(isolationLevel);
  return transaction;
}

// For credit operations, use SERIALIZABLE
const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
```

---

### 4. **Race Condition in Credit Check + Deduct** 🔴

**Location**: `backend/middleware/creditMiddleware.js:8-67` (requireCredits)

**Issue**: Credit check and deduction are separate operations:

```javascript
// Step 1: Check credits (line 21)
const balanceResult = await CreditService.getUserCreditBalance(userId);

// ... request processing happens here ...

// Step 2: Deduct credits (line 90 in deductCreditsAfterSuccess)
const deductResult = await CreditService.deductCredits(...);
```

**Race Condition Scenario**:
```
Time | Request A (Chat)      | Request B (Chat)      | Balance
-----|----------------------|----------------------|--------
T0   | Check: 1 credit      | Check: 1 credit      | 1
T1   | ✅ Pass (balance=1)  | ✅ Pass (balance=1)  | 1
T2   | Process chat...      | Process chat...      | 1
T3   | Deduct 1 credit      |                      | 0
T4   |                      | Deduct 1 credit      | -1 ❌
```

**Result**: Negative balance, free service

**Severity**: 🔴 **CRITICAL** - Financial loss, negative balances

**Recommendation**:
```javascript
// Option 1: Reserve credits during check
function requireCredits(requiredCredits = 1) {
  return async (req, res, next) => {
    // Reserve credits with pessimistic lock
    const reservation = await CreditService.reserveCredits(userId, requiredCredits);
    
    if (!reservation.success) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }
    
    req.creditReservation = reservation.data.reservationId;
    
    // On response, either commit or rollback
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await CreditService.commitReservation(req.creditReservation);
      } else {
        await CreditService.rollbackReservation(req.creditReservation);
      }
    });
    
    next();
  };
}

// Option 2: Optimistic locking with version number
// Add version column to tblCreditBalances
// Check version during update, retry if changed
```

---

### 5. **No Billing Cycle Period Tracking on Plan Change** 🔴

**Location**: `backend/services/BillingService.js:635-642`

**Issue**: When changing plans, the subscription's `current_period_start` and `current_period_end` are NOT updated:

```javascript
await databaseService.query(`
  UPDATE tblSubscriptions SET
    plan_id = @newPlanId,
    billing_cycle = @billingCycle,
    updated_at = GETDATE()
  WHERE organization_id = @organizationId
`, { organizationId, newPlanId, billingCycle });
```

**Problem**:
- Billing period remains from old plan
- If switching from monthly to annual, period is still 1 month
- If switching from annual to monthly, period is still 12 months
- Billing automation will charge at wrong intervals

**Severity**: 🔴 **CRITICAL** - Incorrect billing, revenue loss

**Recommendation**:
```javascript
// Calculate new period based on billing cycle
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
`, { organizationId, newPlanId, billingCycle, newPeriodStart, newPeriodEnd });
```

---

## 🟠 HIGH SEVERITY ISSUES

### 6. **No Monthly Credit Reset Logic** 🟠

**Location**: Missing implementation

**Issue**: The database has `allocation_reset_date` field in `tblCreditBalances`, but there's NO automated job or logic to:
1. Reset `monthly_used` to 0 at the start of each month
2. Allocate new monthly credits
3. Handle credit expiration

**Current State**:
- `monthly_used` keeps accumulating forever
- No monthly credit refresh
- Users will run out of credits and never get more

**Severity**: 🟠 **HIGH** - System becomes unusable after first month

**Recommendation**:
```javascript
// Create scheduled job (cron or similar)
class CreditResetService {
  static async resetMonthlyCredits() {
    const now = new Date();
    
    // Find all balances that need reset
    const balances = await databaseService.query(`
      SELECT cb.*, s.plan_id
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      INNER JOIN tblSubscriptions s ON u.organization_id = s.organization_id
      WHERE cb.allocation_reset_date <= @now
        AND s.status = 'active'
    `, { now });
    
    for (const balance of balances.recordset) {
      // Get plan details
      const plan = await this.getPlan(balance.plan_id);
      
      // Reset monthly_used
      // Allocate new monthly credits
      await databaseService.query(`
        UPDATE tblCreditBalances
        SET monthly_used = 0,
            monthly_allocation = @monthlyCredits,
            current_balance = current_balance + @monthlyCredits,
            allocated_credits = allocated_credits + @monthlyCredits,
            allocation_reset_date = DATEADD(month, 1, allocation_reset_date),
            last_updated = GETDATE()
        WHERE user_id = @userId
      `, {
        userId: balance.user_id,
        monthlyCredits: plan.monthly_credits
      });
      
      // Log transaction
      await CreditService.allocateCredits(
        balance.user_id,
        plan.monthly_credits,
        null, // system
        'Monthly credit allocation'
      );
    }
  }
}

// Schedule to run daily at midnight
// cron: '0 0 * * *'
```

---

### 7. **Missing Credit Adjustment Method** 🟠

**Location**: `backend/services/CreditService.js`

**Issue**: Only `allocateCredits` (add) and `deductCredits` (subtract) exist. No method for:
- Adjusting credits (can be positive or negative)
- Refunds
- Corrections
- Plan downgrade forfeitures

**Severity**: 🟠 **HIGH** - Cannot handle plan changes properly

**Recommendation**:
```javascript
/**
 * Adjust credits (can be positive or negative)
 * Used for refunds, corrections, plan changes
 */
static async adjustCredits(userId, amount, adminUserId, reason, adjustmentType = 'manual') {
  const transaction = await databaseService.beginTransaction();
  
  try {
    const balanceResult = await transaction.request()
      .input('userId', userId)
      .query(`
        SELECT current_balance, allocated_credits, organization_id
        FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
        WHERE user_id = @userId
      `);
    
    const balance = balanceResult.recordset[0];
    const newBalance = balance.current_balance + amount;
    
    // Prevent negative balance for deductions
    if (newBalance < 0 && amount < 0) {
      await transaction.rollback();
      return {
        success: false,
        error: 'Adjustment would result in negative balance'
      };
    }
    
    // Update balance
    await transaction.request()
      .input('userId', userId)
      .input('newBalance', newBalance)
      .input('newAllocated', balance.allocated_credits + amount)
      .query(`
        UPDATE tblCreditBalances
        SET current_balance = @newBalance,
            allocated_credits = @newAllocated,
            last_updated = GETDATE()
        WHERE user_id = @userId
      `);
    
    // Create transaction record
    const transactionId = `adj_${Date.now()}_${userId}`;
    await transaction.request()
      .input('transactionId', transactionId)
      .input('userId', userId)
      .input('organizationId', balance.organization_id)
      .input('type', amount > 0 ? 'credit' : 'adjustment')
      .input('amount', Math.abs(amount))
      .input('balanceBefore', balance.current_balance)
      .input('balanceAfter', newBalance)
      .input('serviceType', adjustmentType)
      .input('adminUserId', adminUserId)
      .input('notes', reason)
      .query(`
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
        amountAdjusted: amount
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

---

### 8. **No Validation for Negative Credits** 🟠

**Location**: `backend/services/CreditService.js:173-175`

**Issue**: While there's a CHECK constraint in the database, the application doesn't validate before attempting the update:

```javascript
const newBalance = balance.current_balance - amount;
// No check if newBalance < 0 before UPDATE
```

**Problem**:
- Relies on database constraint to catch negative balances
- Poor error handling
- Transaction rollback happens at DB level, not application level

**Severity**: 🟠 **HIGH** - Poor error handling, unclear error messages

**Recommendation**:
```javascript
// Add explicit check before update
if (balance.current_balance < amount) {
  await transaction.rollback();
  return {
    success: false,
    error: 'Insufficient credits',
    currentBalance: balance.current_balance,
    requiredAmount: amount,
    shortfall: amount - balance.current_balance
  };
}
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 9. **Subscription Status Not Checked in Credit Operations** 🟡

**Location**: `backend/services/CreditService.js:14-76` (getUserCreditBalance)

**Issue**: Credit operations don't verify if the user's subscription is active:

```javascript
static async getUserCreditBalance(userId) {
  const result = await databaseService.query(`
    SELECT cb.current_balance, ...
    FROM tblCreditBalances cb
    INNER JOIN tblUsers u ON cb.user_id = u.id
    INNER JOIN tblOrganizations o ON cb.organization_id = o.id
    WHERE cb.user_id = @userId
  `, { userId });
  // No check for subscription status
}
```

**Problem**:
- Users with cancelled/expired subscriptions can still use credits
- No enforcement of subscription status

**Severity**: 🟡 **MEDIUM** - Business logic violation

**Recommendation**:
```javascript
// Add subscription status check
const result = await databaseService.query(`
  SELECT 
    cb.current_balance,
    cb.allocated_credits,
    s.status as subscription_status,
    s.current_period_end
  FROM tblCreditBalances cb
  INNER JOIN tblUsers u ON cb.user_id = u.id
  INNER JOIN tblOrganizations o ON cb.organization_id = o.id
  LEFT JOIN tblSubscriptions s ON o.id = s.organization_id
  WHERE cb.user_id = @userId
`, { userId });

if (balance.subscription_status !== 'active') {
  return {
    success: false,
    error: 'Subscription is not active',
    subscriptionStatus: balance.subscription_status
  };
}
```

---

### 10. **No Audit Trail for Plan Changes** 🟡

**Location**: `backend/services/BillingService.js:606-666`

**Issue**: Plan changes don't create detailed audit records:
- No record of old plan
- No record of credit adjustments
- No record of proration calculations

**Severity**: 🟡 **MEDIUM** - Compliance and debugging issues

**Recommendation**:
```javascript
// Create plan change audit table
CREATE TABLE tblPlanChangeHistory (
  id INT IDENTITY(1,1) PRIMARY KEY,
  organization_id NVARCHAR(50) NOT NULL,
  old_plan_id NVARCHAR(50) NOT NULL,
  new_plan_id NVARCHAR(50) NOT NULL,
  old_billing_cycle NVARCHAR(20) NOT NULL,
  new_billing_cycle NVARCHAR(20) NOT NULL,
  effective_date DATETIME2 NOT NULL,
  proration_amount DECIMAL(10,2) NULL,
  credit_adjustment INT NULL,
  changed_by INT NOT NULL,
  reason NVARCHAR(500) NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

---

## 📊 Plan Change Behavior Analysis

### Current Behavior Summary

| Scenario | Current Behavior | Expected Behavior | Status |
|----------|------------------|-------------------|--------|
| **Upgrade (Starter → Professional)** | Adds 180,000 credits on top of existing | Prorate difference or replace | ❌ BROKEN |
| **Downgrade (Professional → Starter)** | Adds 30,000 credits on top of existing | Cap at 30,000 or forfeit excess | ❌ BROKEN |
| **Monthly → Annual** | Changes billing_cycle, adds credits | Prorate for remaining period | ❌ BROKEN |
| **Annual → Monthly** | Changes billing_cycle, adds credits | Calculate refund/adjustment | ❌ BROKEN |
| **Mid-cycle change** | Immediate, no proration | Prorate based on days remaining | ❌ NOT IMPLEMENTED |
| **Credit carryover** | All credits carry over | Policy-based (forfeit/carry/expire) | ❌ NO POLICY |
| **Billing period adjustment** | Period NOT updated | Update to match new cycle | ❌ BROKEN |

### Industry Best Practices (Stripe, Twilio, etc.)

#### **Stripe Approach**:
1. **Immediate Upgrade**: Prorate old plan, charge difference, start new plan
2. **Immediate Downgrade**: Credit unused portion, start new plan
3. **End-of-period Change**: Schedule change for next billing date
4. **Credits**: Typically forfeit unused, or provide account credit

#### **Twilio Approach**:
1. **Usage-based**: Credits roll over with expiration date
2. **Plan Change**: Adjust allocation for next period
3. **Downgrade**: Excess credits expire after grace period

#### **Recommended Approach for Kimiya**:

```
UPGRADE (Immediate):
1. Calculate days remaining in current period
2. Calculate prorated credit difference
3. Add prorated credits
4. Charge prorated amount
5. Update billing period to new cycle

DOWNGRADE (Immediate):
1. Calculate days remaining
2. Forfeit excess credits OR
3. Allow grace period (30 days) to use excess
4. Cap future allocations at new plan limit
5. Provide account credit for price difference

BILLING CYCLE CHANGE:
1. Calculate remaining value of current period
2. Apply as credit to new billing cycle
3. Start new period immediately
```

---

## 🔒 Security Issues

### 11. **No Rate Limiting on Credit Operations** 🟡

**Location**: All credit API endpoints

**Issue**: No rate limiting on:
- Credit deduction attempts
- Balance checks
- Transaction history queries

**Attack Scenario**:
- Attacker floods `/api/credits/deduct` with requests
- Even if they fail, causes DB load
- Could be used for timing attacks

**Recommendation**:
```javascript
const rateLimit = require('express-rate-limit');

const creditLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many credit operations, please try again later'
});

router.post('/deduct', authenticateToken, creditLimiter, validateCreditDeduction, ...);
```

---

### 12. **Organization Isolation Not Enforced in Credit Allocation** 🟡

**Location**: `backend/routes/credits.js:198-227`

**Issue**: Admin can allocate credits to ANY user, even outside their organization:

```javascript
router.post('/admin/allocate', authenticateToken, requireAdmin, validateCreditAllocation, async (req, res) => {
  const { userId, amount, notes = null } = req.body;
  const adminUserId = req.user.id;
  
  // No check if userId belongs to admin's organization
  const result = await CreditService.allocateCredits(userId, amount, adminUserId, notes);
}
```

**Severity**: 🟡 **MEDIUM** - Authorization bypass

**Recommendation**:
```javascript
// Verify user belongs to admin's organization
const userOrg = await databaseService.query(`
  SELECT organization_id FROM tblUsers WHERE id = @userId
`, { userId });

if (req.user.role !== 'super_admin' && userOrg.recordset[0].organization_id !== req.user.organization_id) {
  return res.status(403).json({
    success: false,
    error: 'Cannot allocate credits to users outside your organization'
  });
}
```

---

## 📝 Missing Features

### 13. **No Credit Expiration Logic** 🟢

**Issue**: Credits never expire, even though `credit_expiry_days: 365` is defined in config

**Recommendation**: Implement expiration tracking and cleanup job

---

### 14. **No Overage Handling** 🟢

**Issue**: Plans define `extra_minute_cost` but no logic to:
- Track overage usage
- Calculate overage charges
- Bill for overages

**Recommendation**: Implement overage tracking and billing

---

### 15. **No Failed Payment Handling** 🟢

**Issue**: No logic for:
- Retrying failed payments
- Suspending accounts
- Downgrading on payment failure

---

## 🎯 Recommendations Priority

### Immediate (Week 1):
1. 🔴 Fix plan change credit duplication (#1, #2)
2. 🔴 Add transaction isolation level (#3)
3. 🔴 Fix race condition in credit check/deduct (#4)
4. 🔴 Fix billing period on plan change (#5)

### Short-term (Month 1):
5. 🟠 Implement monthly credit reset (#6)
6. 🟠 Add credit adjustment method (#7)
7. 🟠 Add negative balance validation (#8)
8. 🟡 Add subscription status checks (#9)

### Medium-term (Quarter 1):
9. 🟡 Implement plan change audit trail (#10)
10. 🟡 Add rate limiting (#11)
11. 🟡 Fix organization isolation (#12)
12. 🟢 Implement credit expiration (#13)
13. 🟢 Implement overage handling (#14)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-17  
**Next Review**: After critical fixes implemented

