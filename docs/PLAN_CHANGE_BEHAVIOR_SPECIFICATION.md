# Plan Change Behavior Specification

**Document Version**: 1.0  
**Date**: 2025-10-17  
**Status**: 🔴 SPECIFICATION FOR IMPLEMENTATION

---

## 📋 Overview

This document specifies the expected behavior for plan changes (upgrades, downgrades, and billing cycle changes) in the Kimiya Voice AI credit system. It compares current behavior with expected behavior and provides implementation guidelines.

---

## 🎯 Plan Change Scenarios

### Scenario 1: Upgrade (Starter → Professional)

#### **Current Behavior** ❌
```
Initial State:
- Plan: Starter ($49/month, 30,000 credits)
- User Balance: 10,000 credits remaining
- Days into cycle: 15/30 (50% used)

After Upgrade to Professional:
- Plan: Professional ($299/month, 180,000 credits)
- User Balance: 190,000 credits (10,000 + 180,000) ← WRONG!
- Billing Period: Unchanged (still 15 days remaining)
- Charge: $0 (no immediate charge)

Problems:
✗ User gets full Professional credits + keeps Starter credits
✗ No prorated charge
✗ Billing period not updated
✗ Financial loss: ~$125 (half month of Professional)
```

#### **Expected Behavior** ✅
```
Option A: Immediate Upgrade with Proration (RECOMMENDED)
─────────────────────────────────────────────────────────
Initial State:
- Plan: Starter ($49/month, 30,000 credits)
- User Balance: 10,000 credits remaining
- Days into cycle: 15/30 (50% used)
- Days remaining: 15/30 (50%)

Calculations:
1. Unused Starter value: $49 × 50% = $24.50
2. Prorated Professional cost: $299 × 50% = $149.50
3. Charge immediately: $149.50 - $24.50 = $125.00
4. Prorated credit difference: (180,000 - 30,000) × 50% = 75,000

After Upgrade:
- Plan: Professional ($299/month, 180,000 credits)
- User Balance: 10,000 + 75,000 = 85,000 credits
- Billing Period: Reset to 30 days from now
- Charge: $125.00 (prorated difference)
- Next billing: Full $299 in 30 days

Benefits:
✓ Fair pricing (pay for what you use)
✓ Immediate access to Professional features
✓ Clear credit allocation
✓ Proper billing cycle reset

Option B: Upgrade at Next Billing Cycle
────────────────────────────────────────
- Keep current plan until period ends
- Schedule upgrade for next billing date
- No immediate charge
- User continues with Starter limits
```

---

### Scenario 2: Downgrade (Professional → Starter)

#### **Current Behavior** ❌
```
Initial State:
- Plan: Professional ($299/month, 180,000 credits)
- User Balance: 150,000 credits remaining
- Days into cycle: 10/30 (33% used)

After Downgrade to Starter:
- Plan: Starter ($49/month, 30,000 credits)
- User Balance: 180,000 credits (150,000 + 30,000) ← WRONG!
- Billing Period: Unchanged
- Refund: $0

Problems:
✗ User keeps Professional-level credits
✗ Can use 180,000 credits on Starter plan
✗ No refund for unused Professional time
✗ Exploitable: Subscribe high, use little, downgrade, keep credits
```

#### **Expected Behavior** ✅
```
Option A: Immediate Downgrade with Credit Forfeiture (RECOMMENDED)
──────────────────────────────────────────────────────────────────
Initial State:
- Plan: Professional ($299/month, 180,000 credits)
- User Balance: 150,000 credits remaining
- Days into cycle: 10/30 (33% used)
- Days remaining: 20/30 (67%)

Calculations:
1. Unused Professional value: $299 × 67% = $200.33
2. Prorated Starter cost: $49 × 67% = $32.83
3. Account credit: $200.33 - $32.83 = $167.50
4. New credit allocation: 30,000 × 67% = 20,100 credits

After Downgrade:
- Plan: Starter ($49/month, 30,000 credits)
- User Balance: 20,100 credits (excess forfeited)
- Billing Period: Reset to 30 days from now
- Account Credit: $167.50 (applied to next invoice)
- Excess Credits: 150,000 - 20,100 = 129,900 forfeited

Benefits:
✓ Fair refund for unused time
✓ Prevents credit exploitation
✓ Clear policy on excess credits
✓ Proper billing cycle reset

Option B: Downgrade at Next Billing Cycle (SAFER)
──────────────────────────────────────────────────
- Keep Professional plan until period ends
- Schedule downgrade for next billing date
- User can use remaining 150,000 credits
- No refund (user chose to downgrade)
- Next billing: $49 for Starter

Benefits:
✓ Simpler implementation
✓ No refund calculations
✓ User gets full value of paid period
✓ No credit forfeiture disputes

Option C: Grace Period for Excess Credits
──────────────────────────────────────────
- Immediate downgrade to Starter
- Mark 129,900 excess credits as "expiring"
- Grace period: 30 days to use excess
- After 30 days, excess credits expire
- Account credit: $167.50

Benefits:
✓ User-friendly (time to use credits)
✓ Still prevents long-term exploitation
✓ Clear expiration policy
```

---

### Scenario 3: Billing Cycle Change (Monthly → Annual)

#### **Current Behavior** ❌
```
Initial State:
- Plan: Professional Monthly ($299/month, 180,000 credits)
- User Balance: 100,000 credits
- Days into cycle: 20/30 (67% used)

After Change to Annual:
- Plan: Professional Annual ($2,868.80/year, 180,000 credits/month)
- User Balance: 280,000 credits (100,000 + 180,000) ← WRONG!
- Billing Period: Still 10 days remaining ← WRONG!
- Charge: $0

Problems:
✗ Billing period not updated to 12 months
✗ Duplicate credit allocation
✗ No immediate charge for annual plan
✗ Will bill monthly instead of annually
```

#### **Expected Behavior** ✅
```
Option A: Immediate Switch with Proration (RECOMMENDED)
────────────────────────────────────────────────────────
Initial State:
- Plan: Professional Monthly ($299/month, 180,000 credits)
- User Balance: 100,000 credits
- Days into cycle: 20/30 (67% used)
- Days remaining: 10/30 (33%)

Calculations:
1. Unused monthly value: $299 × 33% = $98.67
2. Annual plan cost: $2,868.80 (12 months)
3. Charge immediately: $2,868.80 - $98.67 = $2,770.13
4. Annual credits: 180,000 × 12 = 2,160,000 total
5. Keep existing balance: 100,000 credits

After Switch:
- Plan: Professional Annual ($2,868.80/year)
- User Balance: 100,000 credits (existing)
- Monthly Allocation: 180,000 credits/month
- Billing Period: 365 days from now
- Charge: $2,770.13 (annual - unused monthly)
- Next billing: $2,868.80 in 365 days

Benefits:
✓ Immediate annual discount (20% savings)
✓ Proper 12-month billing cycle
✓ Fair credit for unused monthly time
✓ Clear monthly credit allocation schedule

Option B: Switch at Next Billing Cycle
───────────────────────────────────────
- Keep monthly plan until period ends
- Schedule annual switch for next billing date
- Charge full $2,868.80 at switch
- Simpler, no proration needed
```

---

### Scenario 4: Billing Cycle Change (Annual → Monthly)

#### **Current Behavior** ❌
```
Initial State:
- Plan: Professional Annual ($2,868.80/year)
- User Balance: 1,500,000 credits
- Days into cycle: 180/365 (49% used)

After Change to Monthly:
- Plan: Professional Monthly ($299/month)
- User Balance: 1,680,000 credits (1,500,000 + 180,000) ← WRONG!
- Billing Period: Still 185 days remaining ← WRONG!

Problems:
✗ User keeps 6+ months of credits
✗ Billing period not updated
✗ No refund for unused annual time
```

#### **Expected Behavior** ✅
```
Option A: Immediate Switch with Refund (RECOMMENDED)
────────────────────────────────────────────────────
Initial State:
- Plan: Professional Annual ($2,868.80/year)
- User Balance: 1,500,000 credits
- Days into cycle: 180/365 (49% used)
- Days remaining: 185/365 (51%)

Calculations:
1. Unused annual value: $2,868.80 × 51% = $1,463.09
2. Monthly plan cost: $299
3. Account credit: $1,463.09 - $299 = $1,164.09
4. Monthly credits: 180,000
5. Excess credits: 1,500,000 - 180,000 = 1,320,000

After Switch:
- Plan: Professional Monthly ($299/month)
- User Balance: 180,000 credits (excess forfeited)
- Billing Period: 30 days from now
- Account Credit: $1,164.09 (applied to future invoices)
- Excess Credits: 1,320,000 forfeited with 90-day grace period

Benefits:
✓ Fair refund for unused annual time
✓ Prevents credit hoarding
✓ Clear policy on excess credits
✓ Grace period for user satisfaction

Option B: Switch at Next Billing Cycle (NOT RECOMMENDED)
─────────────────────────────────────────────────────────
- Keep annual plan until year ends
- User must wait up to 12 months
- Poor user experience
```

---

## 🔄 Credit Handling Policies

### Policy 1: Credit Carryover on Upgrade
```
RULE: On upgrade, user receives prorated credit difference
FORMULA: (new_plan_credits - old_plan_credits) × (days_remaining / total_days)
EXAMPLE: (180,000 - 30,000) × (15/30) = 75,000 credits
RATIONALE: User pays for upgrade, should get proportional benefit
```

### Policy 2: Credit Forfeiture on Downgrade
```
RULE: On downgrade, excess credits are forfeited after grace period
GRACE_PERIOD: 30 days
FORMULA: excess = current_balance - new_plan_credits
EXAMPLE: 150,000 - 30,000 = 120,000 credits forfeited after 30 days
RATIONALE: Prevents exploitation, encourages appropriate plan selection
```

### Policy 3: Monthly Credit Reset
```
RULE: Credits reset monthly based on allocation_reset_date
RESET_ACTION: 
  - monthly_used = 0
  - current_balance += monthly_allocation
  - allocated_credits += monthly_allocation
EXAMPLE: User with 5,000 credits gets +30,000 on reset = 35,000 total
RATIONALE: Subscription model with recurring benefits
```

### Policy 4: Credit Expiration
```
RULE: Unused credits expire after 365 days
TRACKING: Add expiration_date to credit transactions
CLEANUP: Daily job removes expired credits
EXCEPTION: Credits from paid top-ups never expire
RATIONALE: Encourages active usage, prevents indefinite accumulation
```

---

## 💰 Proration Calculation Examples

### Example 1: Mid-Month Upgrade
```javascript
function calculateUpgradeProration(oldPlan, newPlan, daysRemaining, totalDays) {
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
    accountCredit: Math.max(0, -chargeAmount)
  };
}

// Usage
const result = calculateUpgradeProration(
  { name: 'Starter', monthly_credits: 30000, price_usd: 49 },
  { name: 'Professional', monthly_credits: 180000, price_usd: 299 },
  15, // days remaining
  30  // total days
);

// Result:
// {
//   creditsToAdd: 75000,
//   chargeAmount: 125.00,
//   accountCredit: 0
// }
```

### Example 2: Mid-Month Downgrade
```javascript
function calculateDowngradeProration(oldPlan, newPlan, currentBalance, daysRemaining, totalDays) {
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
    graceExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  };
}

// Usage
const result = calculateDowngradeProration(
  { name: 'Professional', monthly_credits: 180000, price_usd: 299 },
  { name: 'Starter', monthly_credits: 30000, price_usd: 49 },
  150000, // current balance
  20,     // days remaining
  30      // total days
);

// Result:
// {
//   newBalance: 20000,
//   excessCredits: 130000,
//   accountCredit: 167.33,
//   graceExpirationDate: '2025-11-16T...'
// }
```

---

## 🛠️ Implementation Checklist

### Phase 1: Core Plan Change Logic
- [ ] Implement `calculateUpgradeProration()` function
- [ ] Implement `calculateDowngradeProration()` function
- [ ] Implement `adjustCredits()` method in CreditService
- [ ] Update `changePlan()` to handle credit adjustments
- [ ] Update `changePlan()` to update billing periods
- [ ] Add validation to prevent duplicate allocations

### Phase 2: Credit Expiration
- [ ] Add `expiration_date` column to tblCreditTransactions
- [ ] Add `grace_expiration_date` column to tblCreditBalances
- [ ] Implement credit expiration tracking
- [ ] Create daily cleanup job for expired credits
- [ ] Add UI warnings for expiring credits

### Phase 3: Billing Integration
- [ ] Implement immediate charge for upgrades
- [ ] Implement account credit for downgrades
- [ ] Create proration billing records
- [ ] Add Stripe integration for charges/refunds
- [ ] Implement invoice generation with proration details

### Phase 4: Monthly Reset
- [ ] Implement monthly credit reset job
- [ ] Add scheduling (cron) for reset job
- [ ] Create reset transaction records
- [ ] Add email notifications for resets
- [ ] Handle edge cases (cancelled subscriptions, etc.)

### Phase 5: Audit & Compliance
- [ ] Create tblPlanChangeHistory table
- [ ] Log all plan changes with details
- [ ] Log all credit adjustments
- [ ] Add admin dashboard for plan change history
- [ ] Implement export functionality for audits

---

## 📊 Testing Scenarios

### Test Case 1: Upgrade Starter → Professional (Mid-Cycle)
```
Given: User on Starter plan, 15 days into 30-day cycle, 10,000 credits remaining
When: User upgrades to Professional
Then: 
  - Charge $125 (prorated)
  - Add 75,000 credits (prorated difference)
  - New balance: 85,000 credits
  - Billing period: Reset to 30 days
  - Next charge: $299 in 30 days
```

### Test Case 2: Downgrade Professional → Starter (Mid-Cycle)
```
Given: User on Professional plan, 10 days into 30-day cycle, 150,000 credits remaining
When: User downgrades to Starter
Then:
  - Account credit: $167.33
  - New balance: 20,000 credits
  - Excess credits: 130,000 (grace period 30 days)
  - Billing period: Reset to 30 days
  - Next charge: $49 in 30 days (minus account credit)
```

### Test Case 3: Monthly → Annual (Mid-Cycle)
```
Given: User on Professional Monthly, 20 days into 30-day cycle, 100,000 credits
When: User switches to Annual
Then:
  - Charge $2,770.13 (annual - unused monthly)
  - Keep 100,000 credits
  - Billing period: 365 days
  - Monthly allocation: 180,000 credits/month
  - Next charge: $2,868.80 in 365 days
```

---

**Document Status**: Ready for Implementation  
**Priority**: 🔴 CRITICAL  
**Estimated Effort**: 2-3 weeks for full implementation

