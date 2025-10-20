# Credit System Quick Reference Guide

## 🎯 Quick Overview

**Credit System**: Unified pricing where 1 credit = 1 second of call OR 1 chat message

**Pricing Tiers**:
- Starter: $49/mo → 30,000 credits (500 mins)
- Professional: $299/mo → 180,000 credits (3,000 mins) ⭐
- Business: $899/mo → 720,000 credits (12,000 mins)
- Enterprise: Custom pricing

---

## 📁 Key Files

### Backend
```
backend/
├── services/
│   ├── CreditService.js          # Credit operations
│   └── BillingService.js         # Subscription management
├── routes/
│   ├── credits.js                # Credit API endpoints
│   └── billing.js                # Billing API endpoints
├── middleware/
│   └── creditMiddleware.js       # Auto credit checking/deduction
└── create-credit-system-tables.cjs  # Database setup
```

### Frontend
```
src/
├── contexts/
│   └── CreditContext.tsx         # Global credit state
├── components/credit/
│   ├── CreditBalanceWidget.tsx   # Balance display
│   └── UsageTrackingDisplay.tsx  # Usage charts
├── components/pricing/
│   └── PricingPlans.tsx          # Pricing page
├── pages/
│   ├── CreditDashboard.tsx       # User credit page
│   └── AdminCreditManagement.tsx # Admin panel
├── services/
│   └── creditService.ts          # Frontend API calls
├── hooks/
│   └── useChatWithCredits.ts     # Chat with credits
└── types/
    └── creditTypes.ts            # TypeScript types
```

---

## 🔌 API Endpoints Cheat Sheet

### User Endpoints
```bash
# Get my balance
GET /api/credits/balance
Authorization: Bearer <token>

# Get my transactions
GET /api/credits/transactions?limit=50&offset=0
Authorization: Bearer <token>

# Get my usage metrics
GET /api/credits/usage?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>
```

### Admin Endpoints
```bash
# Allocate credits to user
POST /api/admin/credits/allocate
Authorization: Bearer <admin-token>
{
  "userId": 123,
  "amount": 5000,
  "notes": "Promotional credits"
}

# Get system overview
GET /api/admin/credits/overview
Authorization: Bearer <admin-token>
```

### Billing Endpoints
```bash
# Subscribe to plan
POST /api/billing/subscribe
{
  "organizationId": "org_123",
  "planId": "professional",
  "billingCycle": "annual"
}

# Get billing info
GET /api/billing/organization/:organizationId

# Change plan
POST /api/billing/change-plan
{
  "organizationId": "org_123",
  "newPlanId": "business",
  "billingCycle": "monthly"
}
```

---

## 💻 Code Examples

### Frontend: Display Balance

```typescript
import { useCreditBalance } from '@/contexts/CreditContext';

function MyComponent() {
  const { creditBalance, isLoading } = useCreditBalance();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      Balance: {creditBalance?.available_credits} credits
    </div>
  );
}
```

### Frontend: Send Chat with Credits

```typescript
import { useChatWithCredits } from '@/hooks/useChatWithCredits';

function ChatComponent() {
  const { sendAnalyticsChatMessage } = useChatWithCredits();
  
  const handleSend = async (message: string) => {
    const response = await sendAnalyticsChatMessage(
      { message, workflowId: 'wf_123' },
      {
        onCreditDeducted: (deducted, remaining) => {
          console.log(`Used ${deducted}, ${remaining} left`);
        },
        onInsufficientCredits: (current, required) => {
          alert(`Need ${required} credits, have ${current}`);
        }
      }
    );
  };
  
  return <ChatUI onSend={handleSend} />;
}
```

### Backend: Protect Route

```javascript
const { checkCredits } = require('../middleware/creditMiddleware');

router.post('/api/my-service',
  authenticateToken,
  checkCredits(10), // Require 10 credits
  async (req, res) => {
    // Your service logic
    // Credits auto-deducted on success
    res.json({ success: true });
  }
);
```

### Backend: Manual Credit Operations

```javascript
const CreditService = require('../services/CreditService');

// Get balance
const balance = await CreditService.getUserCreditBalance(userId);
console.log(balance.data.currentBalance);

// Deduct credits
const result = await CreditService.deductCredits(
  userId,
  5,
  'ai_service',
  { serviceId: 'summary_123' },
  'summary_123',
  'ai_summary'
);

// Allocate credits (admin)
const allocation = await CreditService.allocateCredits(
  userId,
  1000,
  adminUserId,
  'Promotional credits'
);
```

---

## 🗄️ Database Quick Queries

### Check User Balance
```sql
SELECT 
  current_balance,
  allocated_credits,
  used_credits,
  monthly_used
FROM tblCreditBalances
WHERE user_id = @userId;
```

### Recent Transactions
```sql
SELECT TOP 10
  transaction_id,
  type,
  amount,
  balance_before,
  balance_after,
  service_type,
  created_at
FROM tblCreditTransactions
WHERE user_id = @userId
ORDER BY created_at DESC;
```

### Usage by Service Type
```sql
SELECT 
  service_type,
  SUM(credit_cost) as total_credits,
  COUNT(*) as count
FROM tblUsageLogs
WHERE user_id = @userId
  AND created_at >= DATEADD(day, -30, GETDATE())
GROUP BY service_type;
```

### Organization Subscription
```sql
SELECT 
  s.status,
  s.billing_cycle,
  s.current_period_end,
  cp.name as plan_name,
  cp.monthly_credits,
  cp.price_usd
FROM tblSubscriptions s
JOIN tblCreditPlans cp ON s.plan_id = cp.id
WHERE s.organization_id = @orgId;
```

---

## 🎨 UI Components

### Credit Balance Widget

```typescript
import { CreditBalanceWidget } from '@/components/credit';

// Minimal variant
<CreditBalanceWidget userId={user.id} variant="minimal" />

// Compact variant (with usage bar)
<CreditBalanceWidget userId={user.id} variant="compact" />

// Detailed variant (full breakdown)
<CreditBalanceWidget 
  userId={user.id} 
  variant="detailed"
  showAlerts={true}
  onViewDetails={() => navigate('/credits')}
/>
```

### Usage Tracking

```typescript
import { UsageTrackingDisplay } from '@/components/credit';

<UsageTrackingDisplay
  userId={user.id}
  showExportButton={true}
/>
```

### Pricing Plans

```typescript
import { PricingPlans } from '@/components/pricing/PricingPlans';

<PricingPlans
  currentPlanId="starter"
  onSelectPlan={(planId, billingCycle) => {
    console.log(`Selected ${planId} with ${billingCycle} billing`);
  }}
/>
```

---

## 🔧 Configuration

### Credit Rates (Frontend & Backend)

```typescript
// src/services/creditService.ts
static readonly CREDIT_RATES = {
  chat_message: 1,              // 1 credit per message
  call_per_minute: 60,          // 60 credits per minute
  storage_per_mb_per_month: 10, // 10 credits per MB/month
  transcription_per_minute: 30, // 30 credits per minute
  ai_summary: 50,               // 50 credits per summary
  ai_analysis: 100              // 100 credits per analysis
};
```

### System Config

```typescript
static readonly SYSTEM_CONFIG = {
  default_allocation: 1000,      // New user credits
  low_balance_threshold: 100,    // Alert threshold
  high_usage_threshold: 0.8,     // 80% usage alert
  credit_expiry_days: 365,       // Credits expire after 1 year
  auto_top_up_enabled: false,
  auto_top_up_threshold: 50,
  auto_top_up_amount: 500
};
```

---

## 🚨 Common Issues & Solutions

### Issue: "Insufficient Credits" Error

**Check:**
```sql
SELECT current_balance FROM tblCreditBalances WHERE user_id = @userId;
```

**Fix:**
```javascript
// Admin allocates credits
await CreditService.allocateCredits(userId, 5000, adminUserId, 'Top-up');
```

### Issue: Balance Not Updating in UI

**Solution:**
```typescript
// Force refresh
const { refreshBalance } = useCreditBalance();
await refreshBalance();
```

### Issue: Transaction Failed

**Check logs:**
```bash
pm2 logs kimiya-voice-backend-dev | grep "CREDITS:"
```

**Check database:**
```sql
-- Look for failed transactions
SELECT * FROM tblCreditTransactions 
WHERE user_id = @userId 
ORDER BY created_at DESC;
```

### Issue: Subscription Not Allocating Credits

**Check:**
```sql
-- Verify subscription exists
SELECT * FROM tblSubscriptions WHERE organization_id = @orgId;

-- Check if credits were allocated
SELECT * FROM tblCreditTransactions 
WHERE organization_id = @orgId 
  AND type = 'allocation'
ORDER BY created_at DESC;
```

**Fix:**
```javascript
// Manually allocate credits for plan
const BillingService = require('./services/BillingService');
await BillingService.allocateCreditsForPlan(planId, orgId, adminUserId);
```

---

## 📊 Monitoring Commands

### Check Backend Status
```bash
pm2 status
pm2 logs kimiya-voice-backend-dev --lines 100
```

### Monitor Credit Operations
```bash
# Real-time credit logs
pm2 logs kimiya-voice-backend-dev | grep "💳 CREDITS:"

# Check for errors
pm2 logs kimiya-voice-backend-dev --err
```

### Database Health
```sql
-- Active subscriptions
SELECT COUNT(*) FROM tblSubscriptions WHERE status = 'active';

-- Total credits in system
SELECT SUM(current_balance) as total_credits FROM tblCreditBalances;

-- Today's usage
SELECT 
  service_type,
  SUM(credit_cost) as credits_used
FROM tblUsageLogs
WHERE created_at >= CAST(GETDATE() AS DATE)
GROUP BY service_type;
```

---

## 🔐 Security Notes

1. **Authentication Required**: All credit endpoints require JWT token
2. **Role-Based Access**: Admin endpoints check for admin role
3. **Organization Isolation**: Users can only access their org's data
4. **Transaction Integrity**: SQL transactions prevent race conditions
5. **Audit Trail**: All operations logged in tblCreditTransactions

---

## 📞 Quick Help

**Need to:**
- Add credits to user → Use Admin Panel or `/api/admin/credits/allocate`
- Check balance → `/api/credits/balance` or CreditBalanceWidget
- View usage → CreditDashboard or UsageTrackingDisplay
- Change plan → `/api/billing/change-plan`
- Debug issues → Check PM2 logs and database queries above

**Documentation:**
- Full docs: `docs/PRICING_CREDIT_SYSTEM_OVERVIEW.md`
- Pricing details: `docs/NEW_PRICING_STRUCTURE.md`
- Original spec: `docs/CREDIT_SYSTEM.md`

---

**Last Updated**: 2025-10-17  
**Quick Reference Version**: 1.0.0

