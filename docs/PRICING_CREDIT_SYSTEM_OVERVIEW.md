# Kimiya Voice AI - Pricing & Credit Management System Overview

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Pricing Structure](#pricing-structure)
3. [Architecture](#architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Credit Flow](#credit-flow)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Key Features](#key-features)
10. [Usage Examples](#usage-examples)

---

## 🎯 System Overview

Kimiya Voice AI implements a **unified credit-based pricing system** where all usage parameters are consolidated into a single credit currency. This provides:

- **Predictable Costs**: Monthly/annual subscription plans with included credits
- **Unified Tracking**: Single credit system for calls, chat, storage, and AI services
- **Competitive Pricing**: Designed to compete with Bland AI, Vapi AI, and Retell AI
- **Flexible Billing**: Monthly or annual billing with 20% discount on annual plans

### Credit Conversion Rates
```
1 credit = 1 second of AI voice call time
1 credit = 1 AI chat message
1 credit = 0.1 MB storage per month
30 credits = 1 minute of transcription
50 credits = 1 AI summary
100 credits = 1 AI analysis
```

---

## 💰 Pricing Structure

### Tier Comparison

| Plan | Price/Month | Credits | Minutes | Messages | Operators | Concurrent Calls | Overage Rate |
|------|-------------|---------|---------|----------|-----------|------------------|--------------|
| **Starter** | $49 | 30,000 | 500 | 2,000 | 2 | 5 | $0.40/min |
| **Professional** ⭐ | $299 | 180,000 | 3,000 | 10,000 | 10 | 25 | $0.25/min |
| **Business** | $899 | 720,000 | 12,000 | 50,000 | 50 | 100 | $0.15/min |
| **Enterprise** | Custom | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | Negotiated |

### Annual Billing Savings (20% Discount)
- **Starter**: $470.40/year (save $117.60)
- **Professional**: $2,868.80/year (save $718.20)
- **Business**: $8,630.40/year (save $2,157.60)

### Competitive Analysis
```
Cost per Minute Comparison:
├── Kimiya Starter:      $0.098/min
├── Kimiya Professional: $0.0997/min
├── Kimiya Business:     $0.0749/min
├── Bland AI:            ~$0.09-0.12/min
├── Vapi AI:             ~$0.05-0.08/min + LLM costs
└── Retell AI:           ~$0.10/min
```

**Key Advantages**:
✅ Predictable monthly costs (hybrid model)
✅ More features included (AI operators, campaigns, team members)
✅ Better value at scale
✅ Included chat messages (not just voice)

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Credit       │  │ Usage        │  │ Admin Credit │      │
│  │ Dashboard    │  │ Tracking     │  │ Management   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Credit       │  │ Pricing      │  │ Billing      │      │
│  │ Widget       │  │ Plans        │  │ Portal       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   CreditContext (State)                      │
│  - Credit Balance                                            │
│  - Credit Summary                                            │
│  - Real-time Updates                                         │
│  - Optimistic Updates                                        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  /api/credits/*          - Credit operations                 │
│  /api/billing/*          - Billing & subscriptions           │
│  /api/admin/credits/*    - Admin credit management           │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  Backend Services (Node.js)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Credit       │  │ Billing      │  │ Usage        │      │
│  │ Service      │  │ Service      │  │ Tracking     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                Database (SQL Server)                         │
├─────────────────────────────────────────────────────────────┤
│  tblCreditBalances    - User credit balances                 │
│  tblCreditTransactions - Transaction history                 │
│  tblCreditPlans       - Subscription plans                   │
│  tblSubscriptions     - Organization subscriptions           │
│  tblUsageLogs         - Detailed usage tracking              │
│  tblPaymentMethods    - Payment information                  │
│  tblBillingHistory    - Invoice records                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Implementation

### Key Services

#### 1. **CreditService** (`backend/services/CreditService.js`)

**Core Functions:**
- `getUserCreditBalance(userId)` - Get current balance
- `deductCredits(userId, amount, serviceType, ...)` - Deduct credits with transaction
- `allocateCredits(userId, amount, adminUserId, notes)` - Admin credit allocation
- `getCreditTransactions(userId, limit, offset)` - Transaction history
- `getUsageMetrics(userId, startDate, endDate)` - Usage analytics
- `initializeUserCreditBalance(userId)` - Create initial balance

**Transaction Flow:**
```javascript
// Credit deduction with full transaction support
1. Begin SQL transaction
2. Lock user's credit balance row
3. Verify sufficient balance
4. Update balance (current_balance, used_credits, monthly_used)
5. Create transaction record
6. Create usage log
7. Commit transaction
8. Return result with before/after balance
```

#### 2. **BillingService** (`backend/services/BillingService.js`)

**Core Functions:**
- `createOrUpdateSubscription(orgId, planId, paymentMethodId, billingAddress, userId, billingCycle)`
- `cancelSubscription(orgId, cancelAtPeriodEnd, userId)`
- `changePlan(orgId, newPlanId, effectiveDate, billingCycle, userId)`
- `getOrganizationBilling(orgId)` - Complete billing info
- `addPaymentMethod(orgId, paymentMethodData, userId)`
- `getBillingHistory(orgId, limit, offset)`
- `allocateCreditsForPlan(planId, orgId, adminUserId)` - Monthly credit allocation

**Subscription Flow:**
```javascript
1. Validate plan exists
2. Check for existing subscription
3. Calculate billing period (monthly: +1 month, annual: +12 months)
4. Create/update subscription record
5. Allocate credits to all organization users
6. Create billing history record
7. Return subscription details
```

### Middleware

#### **creditMiddleware.js**

**Functions:**
- `checkCredits(requiredCredits)` - Pre-check before operation
- `deductCreditsAfterSuccess(req, serviceType, ...)` - Post-operation deduction

**Usage Pattern:**
```javascript
// In route handler
router.post('/api/chat', 
  authenticateToken,
  checkCredits(1), // Check 1 credit for chat message
  async (req, res) => {
    // Process chat
    // Credits automatically deducted on success
  }
);
```

---

## 🎨 Frontend Implementation

### Key Components

#### 1. **CreditBalanceWidget** (`src/components/credit/CreditBalanceWidget.tsx`)

**Variants:**
- `minimal` - Compact display with just balance
- `compact` - Balance + usage bar
- `detailed` - Full breakdown with alerts

**Features:**
- Real-time balance updates
- Usage projections
- Low balance alerts
- Animated number transitions
- Responsive design

#### 2. **UsageTrackingDisplay** (`src/components/credit/UsageTrackingDisplay.tsx`)

**Displays:**
- Chat usage (messages, sessions)
- Inbound call usage (duration, count)
- Outbound call usage (duration, count)
- Storage usage (conversations, data size)
- Transcription & AI services

**Features:**
- Period selection (7/30/90 days, custom)
- Usage charts
- Export functionality
- Service-specific breakdowns

#### 3. **CreditDashboard** (`src/pages/CreditDashboard.tsx`)

**Sections:**
- Credit balance overview
- Usage tracking tab
- Transaction history tab
- Quick actions (add credits, export)

#### 4. **AdminCreditManagement** (`src/pages/AdminCreditManagement.tsx`)

**Admin Features:**
- System-wide credit overview
- User credit allocation
- Top users by usage
- Low balance alerts
- Usage breakdown by service
- Export reports

#### 5. **PricingPlans** (`src/components/pricing/PricingPlans.tsx`)

**Features:**
- Monthly/Annual toggle
- Real-time price calculations
- Savings display
- Feature comparison
- Credit explanation tooltips
- Responsive cards

### State Management

#### **CreditContext** (`src/contexts/CreditContext.tsx`)

**Provides:**
- `creditBalance` - Current balance
- `creditSummary` - Comprehensive summary
- `refreshBalance()` - Manual refresh
- `updateBalanceAfterDeduction(amount)` - Optimistic update
- `subscribeToBalanceUpdates(callback)` - Real-time subscriptions

**Auto-refresh:**
- On authentication state change
- Every 2 minutes (when authenticated)
- On window focus
- After credit deduction

---

## 💳 Credit Flow

### User Credit Deduction Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Action (Chat Message / Call / AI Service)           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Middleware: checkCredits(requiredAmount)                  │
│    - Fetch current balance                                   │
│    - Verify sufficient credits                               │
│    - Return 402 if insufficient                              │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Process Request (Chat / Call / Service)                   │
│    - Execute the actual service                              │
│    - Generate response                                       │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Middleware: deductCreditsAfterSuccess()                   │
│    - Only if request succeeded                               │
│    - Deduct credits via CreditService                        │
│    - Create transaction record                               │
│    - Create usage log                                        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Response to Client                                        │
│    - Include credit info in response                         │
│    - creditsDeducted, remainingBalance, transactionId        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Frontend Update                                           │
│    - Optimistic update (immediate)                           │
│    - Server refresh (after 1 second)                         │
│    - Toast notification                                      │
└─────────────────────────────────────────────────────────────┘
```

### Admin Credit Allocation Flow

```
Admin → Allocate Credits Dialog → Select User + Amount + Reason
                                          ↓
                        POST /api/admin/credits/allocate
                                          ↓
                        BillingService.allocateCredits()
                                          ↓
                        ┌─────────────────────────────┐
                        │ 1. Begin Transaction        │
                        │ 2. Update Credit Balance    │
                        │ 3. Create Transaction       │
                        │ 4. Commit                   │
                        └─────────────────────────────┘
                                          ↓
                        Success Response + Refresh UI
```

---

## 🔌 API Endpoints

### Credit Endpoints

```
GET    /api/credits/balance              - Get current user balance
GET    /api/credits/balance/:userId      - Get specific user balance (admin)
POST   /api/credits/deduct               - Deduct credits (internal)
GET    /api/credits/transactions         - Get transaction history
GET    /api/credits/usage                - Get usage metrics
POST   /api/admin/credits/allocate       - Allocate credits (admin)
GET    /api/admin/credits/overview       - System overview (admin)
```

### Billing Endpoints

```
GET    /api/billing/organization/:orgId  - Get billing info
POST   /api/billing/subscribe            - Create/update subscription
POST   /api/billing/cancel               - Cancel subscription
POST   /api/billing/change-plan          - Change plan
POST   /api/billing/payment-methods      - Add payment method
GET    /api/billing/payment-methods/:orgId - Get payment methods
DELETE /api/billing/payment-methods/:id  - Remove payment method
GET    /api/billing/history/:orgId       - Get billing history
```

### Request/Response Examples

#### Get Credit Balance
```javascript
GET /api/credits/balance
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "currentBalance": 15000,
    "allocatedCredits": 30000,
    "usedCredits": 15000,
    "monthlyAllocation": 30000,
    "monthlyUsed": 5000,
    "projectedMonthlyUsage": 15000,
    "lastUpdated": "2025-10-17T10:30:00Z"
  }
}
```

#### Deduct Credits (Internal)
```javascript
POST /api/credits/deduct
Authorization: Bearer <token>
{
  "amount": 1,
  "serviceType": "chat",
  "serviceDetails": {
    "messageId": "msg_123",
    "sessionId": "session_456"
  },
  "referenceId": "msg_123",
  "referenceType": "chat_message"
}

Response:
{
  "success": true,
  "data": {
    "transactionId": "txn_789",
    "balanceBefore": 15000,
    "balanceAfter": 14999,
    "amountDeducted": 1,
    "timestamp": "2025-10-17T10:30:00Z"
  }
}
```

#### Subscribe to Plan
```javascript
POST /api/billing/subscribe
Authorization: Bearer <token>
{
  "organizationId": "org_123",
  "planId": "professional",
  "billingCycle": "annual",
  "paymentMethodId": "pm_456",
  "billingAddress": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94102",
    "country": "US"
  }
}

Response:
{
  "success": true,
  "data": {
    "subscription_id": "sub_789",
    "plan_id": "professional",
    "billing_cycle": "annual",
    "status": "active",
    "current_period_start": "2025-10-17T00:00:00Z",
    "current_period_end": "2026-10-17T00:00:00Z",
    "credits_allocated": 180000,
    "message": "Subscription created successfully"
  }
}
```

---

## 🗄️ Database Schema

### Core Tables

#### **tblCreditBalances**
```sql
CREATE TABLE tblCreditBalances (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  organization_id NVARCHAR(50) NOT NULL,
  current_balance INT NOT NULL DEFAULT 0,
  allocated_credits INT NOT NULL DEFAULT 0,
  used_credits INT NOT NULL DEFAULT 0,
  monthly_allocation INT NOT NULL DEFAULT 0,
  monthly_used INT NOT NULL DEFAULT 0,
  allocation_reset_date DATETIME2 NOT NULL,
  last_updated DATETIME2 NOT NULL DEFAULT GETDATE(),
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),

  CONSTRAINT FK_tblCreditBalances_user_id
    FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE,
  CONSTRAINT FK_tblCreditBalances_organization_id
    FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id)
);
```

#### **tblCreditTransactions**
```sql
CREATE TABLE tblCreditTransactions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  transaction_id NVARCHAR(50) NOT NULL DEFAULT NEWID(),
  user_id INT NOT NULL,
  organization_id NVARCHAR(50) NOT NULL,
  type NVARCHAR(50) NOT NULL, -- 'debit', 'credit', 'allocation', 'refund', 'adjustment'
  amount INT NOT NULL,
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  service_type NVARCHAR(50) NOT NULL, -- 'chat', 'inbound_call', 'outbound_call', etc.
  service_details NVARCHAR(MAX) NULL, -- JSON string
  reference_id NVARCHAR(255) NULL,
  reference_type NVARCHAR(50) NULL,
  created_by INT NULL,
  notes NVARCHAR(500) NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),

  CONSTRAINT CK_tblCreditTransactions_type
    CHECK (type IN ('debit', 'credit', 'allocation', 'refund', 'adjustment')),
  CONSTRAINT CK_tblCreditTransactions_service_type
    CHECK (service_type IN ('chat', 'inbound_call', 'outbound_call', 'storage',
                            'transcription', 'ai_service', 'manual', 'system'))
);
```

#### **tblCreditPlans**
```sql
CREATE TABLE tblCreditPlans (
  id NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL,
  description NVARCHAR(500) NOT NULL,
  monthly_credits INT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  annual_price_usd DECIMAL(10,2) NULL,
  billing_cycle NVARCHAR(20) DEFAULT 'monthly',
  is_popular BIT NOT NULL DEFAULT 0,
  is_enterprise BIT NOT NULL DEFAULT 0,
  is_active BIT NOT NULL DEFAULT 1,

  -- Features
  ai_operators INT NOT NULL DEFAULT 1,
  concurrent_calls INT NOT NULL DEFAULT 5,
  campaigns_per_month INT NOT NULL DEFAULT 1,
  ai_messages INT NOT NULL DEFAULT 1000,
  team_members INT NOT NULL DEFAULT 1,
  extra_minute_cost DECIMAL(5,3) NOT NULL DEFAULT 0.15,
  extra_credit_cost DECIMAL(10,6) NULL,
  minutes_included INT NULL,
  cost_per_minute DECIMAL(10,4) NULL,

  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

#### **tblSubscriptions**
```sql
CREATE TABLE tblSubscriptions (
  id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
  organization_id NVARCHAR(50) NOT NULL,
  plan_id NVARCHAR(50) NOT NULL,
  status NVARCHAR(50) NOT NULL DEFAULT 'active',
  billing_cycle NVARCHAR(20) DEFAULT 'monthly',
  current_period_start DATETIME2 NOT NULL,
  current_period_end DATETIME2 NOT NULL,
  cancel_at_period_end BIT NOT NULL DEFAULT 0,
  stripe_subscription_id NVARCHAR(255) NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),

  CONSTRAINT FK_tblSubscriptions_organization_id
    FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id),
  CONSTRAINT FK_tblSubscriptions_plan_id
    FOREIGN KEY (plan_id) REFERENCES tblCreditPlans(id)
);
```

#### **tblUsageLogs**
```sql
CREATE TABLE tblUsageLogs (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  organization_id NVARCHAR(50) NOT NULL,
  service_type NVARCHAR(50) NOT NULL,
  usage_amount DECIMAL(10,2) NOT NULL,
  usage_units NVARCHAR(50) NOT NULL DEFAULT 'credits',
  service_metadata NVARCHAR(MAX) NULL, -- JSON string
  reference_id NVARCHAR(255) NULL,
  reference_type NVARCHAR(50) NULL,
  credit_cost INT NOT NULL,
  rate_applied DECIMAL(10,4) NOT NULL DEFAULT 1.0,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),

  CONSTRAINT FK_tblUsageLogs_user_id
    FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX IX_tblCreditBalances_user_id ON tblCreditBalances(user_id);
CREATE INDEX IX_tblCreditTransactions_user_id ON tblCreditTransactions(user_id);
CREATE INDEX IX_tblCreditTransactions_created_at ON tblCreditTransactions(created_at DESC);
CREATE INDEX IX_tblUsageLogs_user_id_created_at ON tblUsageLogs(user_id, created_at DESC);
CREATE INDEX IX_tblSubscriptions_organization_id ON tblSubscriptions(organization_id);
```

---

## ✨ Key Features

### 1. **Real-Time Credit Tracking**
- Automatic balance updates after each operation
- Optimistic UI updates for instant feedback
- Server-side validation and reconciliation
- WebSocket support for multi-device sync (planned)

### 2. **Transaction Integrity**
- SQL transactions ensure atomic operations
- Row-level locking prevents race conditions
- Rollback on failure
- Complete audit trail

### 3. **Usage Analytics**
- Service-specific breakdowns
- Historical trends and charts
- Projected usage calculations
- Export functionality

### 4. **Admin Controls**
- Manual credit allocation
- System-wide overview
- User management
- Usage monitoring
- Low balance alerts

### 5. **Flexible Billing**
- Monthly or annual cycles
- Automatic credit allocation
- Overage handling
- Plan upgrades/downgrades
- Proration support (planned)

### 6. **Security**
- JWT authentication
- Role-based access control
- Organization-level isolation
- Audit logging

### 7. **User Experience**
- Responsive design
- Real-time notifications
- Low balance warnings
- Usage projections
- Intuitive dashboards

---

## 📝 Usage Examples

### Frontend: Display Credit Balance

```typescript
import { CreditBalanceWidget } from '@/components/credit';
import { useCreditBalance } from '@/contexts/CreditContext';

function Dashboard() {
  const { creditBalance, refreshBalance } = useCreditBalance();

  return (
    <div>
      <CreditBalanceWidget
        userId={user.id}
        variant="detailed"
        showAlerts={true}
        onViewDetails={() => navigate('/credits')}
      />

      <button onClick={refreshBalance}>
        Refresh Balance
      </button>
    </div>
  );
}
```

### Frontend: Send Chat with Credit Deduction

```typescript
import { useChatWithCredits } from '@/hooks/useChatWithCredits';

function ChatInterface() {
  const { sendAnalyticsChatMessage } = useChatWithCredits();

  const handleSendMessage = async (message: string) => {
    try {
      const response = await sendAnalyticsChatMessage(
        {
          message,
          workflowId: currentWorkflow.id,
          sessionId: sessionId
        },
        {
          onCreditDeducted: (deducted, remaining) => {
            console.log(`${deducted} credits deducted, ${remaining} remaining`);
          },
          onInsufficientCredits: (current, required) => {
            alert(`Insufficient credits: ${current}/${required}`);
          }
        }
      );

      // Handle response
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  return <ChatUI onSend={handleSendMessage} />;
}
```

### Backend: Protect Route with Credit Check

```javascript
const { checkCredits } = require('../middleware/creditMiddleware');

// Chat endpoint with automatic credit deduction
router.post('/api/chat-with-analytics',
  authenticateToken,
  checkCredits(1), // Require 1 credit
  async (req, res) => {
    try {
      // Process chat request
      const response = await processChat(req.body);

      // Credits automatically deducted on success
      res.json({
        success: true,
        response: response.message,
        // Credit info added by middleware
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

### Backend: Admin Allocate Credits

```javascript
const CreditService = require('../services/CreditService');

// Admin allocates credits to user
async function allocateCreditsToUser(userId, amount, adminUserId, reason) {
  const result = await CreditService.allocateCredits(
    userId,
    amount,
    adminUserId,
    reason
  );

  if (result.success) {
    console.log(`Allocated ${amount} credits to user ${userId}`);
    console.log(`New balance: ${result.data.balanceAfter}`);
  } else {
    console.error('Allocation failed:', result.error);
  }

  return result;
}
```

### Backend: Subscribe Organization to Plan

```javascript
const BillingService = require('../services/BillingService');

async function subscribeOrganization(orgId, planId, billingCycle = 'monthly') {
  const result = await BillingService.createOrUpdateSubscription(
    orgId,
    planId,
    null, // paymentMethodId (optional)
    null, // billingAddress (optional)
    adminUserId,
    billingCycle
  );

  if (result.success) {
    console.log('Subscription created:', result.data);
    console.log(`Credits allocated: ${result.data.credits_allocated}`);
  }

  return result;
}
```

---

## 🚀 Implementation Status

### ✅ Completed Features

- [x] Database schema and tables
- [x] Backend credit service (deduction, allocation, tracking)
- [x] Backend billing service (subscriptions, plans, payments)
- [x] Credit middleware for automatic deduction
- [x] Frontend credit context and state management
- [x] Credit balance widget (3 variants)
- [x] Usage tracking display
- [x] Credit dashboard (user-facing)
- [x] Admin credit management UI
- [x] Pricing plans component
- [x] Transaction history
- [x] Real-time balance updates
- [x] Monthly/annual billing support
- [x] Role-based access control
- [x] API endpoints for all operations

### 🚧 In Progress / Planned

- [ ] Stripe payment integration
- [ ] Automated billing cycles
- [ ] Invoice generation and email
- [ ] Failed payment handling
- [ ] Plan proration for mid-cycle changes
- [ ] WebSocket for real-time multi-device sync
- [ ] Advanced analytics and reporting
- [ ] Usage alerts and notifications
- [ ] Credit purchase flow (self-service)
- [ ] Referral program
- [ ] Enterprise custom pricing workflow

---

## 📊 Business Metrics

### Revenue Projections

**Conservative Scenario (100 customers)**:
- 40 Starter @ $49 = $1,960/month
- 50 Professional @ $299 = $14,950/month
- 10 Business @ $899 = $8,990/month
- **Total MRR**: $25,900 ($310,800 ARR)

**Growth Scenario (500 customers)**:
- 150 Starter @ $49 = $7,350/month
- 300 Professional @ $299 = $89,700/month
- 45 Business @ $899 = $40,455/month
- 5 Enterprise @ $3,000 = $15,000/month
- **Total MRR**: $152,505 ($1,830,060 ARR)

### Key Performance Indicators (KPIs)

Track these metrics:
- Conversion rate by plan tier
- Monthly vs annual billing split
- Average revenue per user (ARPU)
- Plan upgrade/downgrade rate
- Overage revenue percentage
- Customer lifetime value (LTV)
- Churn rate by plan
- Credit utilization rate
- Average credits per user per month

---

## 🔍 Monitoring & Debugging

### Logs to Monitor

```bash
# Backend logs (PM2)
pm2 logs kimiya-voice-backend-dev

# Credit-specific logs
grep "CREDITS:" ~/.pm2/logs/kimiya-voice-backend-dev-out.log

# Database queries
# Check SQL Server logs for slow queries or deadlocks
```

### Common Issues

1. **Insufficient Credits Error (402)**
   - Check user's current balance
   - Verify credit allocation
   - Check monthly reset date

2. **Transaction Failures**
   - Check for SQL deadlocks
   - Verify database connection
   - Check transaction timeout settings

3. **Balance Mismatch**
   - Compare `current_balance` with `allocated_credits - used_credits`
   - Check for failed transactions
   - Review transaction history

### Debug Queries

```sql
-- Check user's credit balance
SELECT * FROM tblCreditBalances WHERE user_id = @userId;

-- Recent transactions
SELECT TOP 10 * FROM tblCreditTransactions
WHERE user_id = @userId
ORDER BY created_at DESC;

-- Usage breakdown
SELECT
  service_type,
  SUM(credit_cost) as total_credits,
  COUNT(*) as usage_count
FROM tblUsageLogs
WHERE user_id = @userId
  AND created_at >= DATEADD(month, -1, GETDATE())
GROUP BY service_type;

-- Organization subscription
SELECT s.*, cp.*
FROM tblSubscriptions s
JOIN tblCreditPlans cp ON s.plan_id = cp.id
WHERE s.organization_id = @orgId;
```

---

## 📚 Related Documentation

- [CREDIT_SYSTEM.md](./CREDIT_SYSTEM.md) - Original credit system documentation
- [NEW_PRICING_STRUCTURE.md](./NEW_PRICING_STRUCTURE.md) - Pricing structure details
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Overall implementation summary

---

## 🤝 Support

For questions or issues:
- **Technical**: Check backend logs in PM2
- **Database**: Review SQL Server logs
- **Frontend**: Check browser console
- **API Testing**: Use test scripts in `/backend/test-*.js`

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
**Status**: ✅ Production Ready (Payment integration pending)


