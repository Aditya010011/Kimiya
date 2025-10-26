# Kimiya Voice - Role Hierarchy & Credit System Documentation

**Document Purpose**: Comprehensive explanation of the two-tier role system and hybrid credit architecture  
**Target Audience**: QA Testers, Developers, Product Managers  
**Last Updated**: October 26, 2025

---

## EXECUTIVE SUMMARY

The Kimiya Voice platform implements:

1. **Two-Tier Role System**
   - Regular User (default): Can only access/manage own data
   - Admin (elevated): Can access/manage all users and system features

2. **Hybrid Credit Architecture**
   - Per-user credit balances (each user has individual balance)
   - Organization-wide subscriptions (plan purchased at org level)
   - Full allocation to all users (not split)

---

## PART 1: USER ROLE HIERARCHY

### Role Definitions

**Regular User**
- Default role for all new accounts
- Can access core platform features
- Can only view/manage own data
- Cannot access admin panel
- Cannot manage other users
- Cannot allocate credits

**Admin**
- Elevated role for administrators
- Can access all features including admin panel
- Can view/manage all users in organization
- Can allocate credits to users
- Can manage organization billing
- Can view system-wide statistics

### Role Enforcement

**Frontend**: Protected routes with `requiredRole="admin"` show "Access Denied" page  
**Backend**: API endpoints with `requireAdmin` middleware return 403 Forbidden  
**Database**: User role stored in `tblUsers.role` column (values: 'user' or 'admin')

### Feature Access Matrix

| Feature | Regular User | Admin |
|---------|:---:|:---:|
| Dashboard | ✅ | ✅ |
| Workflow Builder | ✅ | ✅ |
| Chat Playground | ✅ | ✅ |
| Contacts | ✅ | ✅ |
| Own Credit Balance | ✅ | ✅ |
| Own Transactions | ✅ | ✅ |
| **User Management** | ❌ | ✅ |
| **View All Users** | ❌ | ✅ |
| **User Details** | ❌ | ✅ |
| **User Chat History** | ❌ | ✅ |
| **Activate/Deactivate Users** | ❌ | ✅ |
| **Admin Credit Allocation** | ❌ | ✅ |
| **View All Credit Balances** | ❌ | ✅ |
| **Admin Billing Dashboard** | ❌ | ✅ |
| **Manage Organization Plan** | ❌ | ✅ |

### Admin-Only Routes

**Frontend Routes** (show "Access Denied" page):
- `/admin/users` - User Management
- `/admin/users/:userId/analytics` - User Analytics
- `/admin/credits` - Credit Management
- `/admin/billing` - Billing Management

**Backend API Endpoints** (return 403 Forbidden):
- `GET /api/auth/admin/users` - Get all users
- `GET /api/auth/admin/users/:userId` - Get user details
- `GET /api/auth/admin/users/:userId/analytics` - Get user analytics
- `POST /api/auth/admin/users/:userId/activate` - Activate user
- `POST /api/auth/admin/users/:userId/deactivate` - Deactivate user
- `DELETE /api/auth/admin/users/:userId` - Delete user
- `GET /api/admin/credits/overview` - Get credit overview
- `GET /api/admin/credits/statistics` - Get credit statistics
- `POST /api/admin/credits/allocate` - Allocate credits
- `POST /api/admin/credits/run-reset-job` - Trigger credit reset
- `POST /api/admin/credits/cleanup-expired` - Cleanup expired credits
- `GET /api/admin/billing/*` - All billing endpoints

### Data Visibility Rules

**Regular Users Can See:**
- ✅ Own profile information
- ✅ Own workflows
- ✅ Own contacts
- ✅ Own credit balance
- ✅ Own transaction history
- ✅ Own chat history

**Regular Users CANNOT See:**
- ❌ Other users' profiles
- ❌ Other users' workflows
- ❌ Other users' contacts
- ❌ Other users' credit balances
- ❌ Other users' transaction history
- ❌ Other users' chat history
- ❌ Organization-wide statistics
- ❌ System-wide analytics

**Admins Can See:**
- ✅ All users' profiles
- ✅ All users' workflows
- ✅ All users' contacts
- ✅ All users' credit balances
- ✅ All users' transaction history
- ✅ All users' chat history
- ✅ Organization-wide statistics
- ✅ System-wide analytics

---

## PART 2: CREDIT SYSTEM ARCHITECTURE

### Model Overview

**Hybrid Per-User + Organization-Wide Model**

- **Per-User**: Each user has individual credit balance
- **Organization-Wide**: Credits allocated at organization level
- **Shared Subscription**: All users share same plan

### Credit Allocation Flow

**When Plan is Purchased:**

1. Organization purchases plan (e.g., Professional = 180,000 credits/month)
2. Credits allocated to **ALL users** in organization
3. **Each user receives FULL allocation** (not split)
4. Billing cycle reset date updated for all users

**Example:**
- Organization has 3 users
- Professional Plan purchased (180,000 credits/month)
- User 1 receives: 180,000 credits
- User 2 receives: 180,000 credits
- User 3 receives: 180,000 credits
- **Total organization credits**: 540,000 credits

### Credit Visibility

**Regular Users See:**
- ✅ Own credit balance
- ✅ Own transaction history
- ❌ Other users' balances
- ❌ Organization-wide pool
- ❌ System statistics

**Admins See:**
- ✅ Own credit balance
- ✅ Own transaction history
- ✅ All users' balances
- ✅ All users' transactions
- ✅ System-wide statistics:
  - Total credits allocated
  - Total credits used
  - Total credits remaining
  - Users with low balance
  - Users with high usage
  - Usage by service type

### Admin Credit Allocation

**Admins can manually allocate credits to individual users:**

**Allocation Types:**
- `top_up` - Additional credits
- `bonus` - Promotional credits
- `refund` - Refund for overcharge
- `adjustment` - Manual adjustment

**Process:**
1. Admin goes to Admin Panel > Credit Management
2. Selects user
3. Enters amount
4. Enters reason/notes
5. Clicks "Allocate"
6. Credits added immediately
7. Transaction recorded

**Example Scenarios:**
- User runs out of credits: Allocate 50,000 bonus credits
- User overcharged: Allocate -10,000 refund credits
- Promotional offer: Allocate 100,000 bonus credits

### Credit Deduction

**Automatic deduction for:**
- Chat messages: 1 credit per message
- Call time: 1 credit per second
- Storage: Credits per MB per month
- Transcription: Credits per minute
- AI services: Credits per operation

**Deduction is Per-User:**
- Only user who initiated action loses credits
- Other users' balances unaffected
- Deduction happens in real-time

**Example:**
- User 1 and User 2 both have 100,000 credits
- User 1 sends 10 chat messages
- User 1 balance: 99,990 (decreased by 10)
- User 2 balance: 100,000 (unchanged)

### Credit Expiration

- **Expiration Period**: 365 days (1 year)
- **Automatic Cleanup**: Expired credits removed automatically
- **Admin Control**: Can manually trigger cleanup
- **Reset on Purchase**: New credits reset expiration date

### Monthly Billing Cycle

- **Reset Frequency**: Monthly on subscription renewal date
- **What Resets**: monthly_used counter, monthly_allocation
- **What Updates**: allocation_reset_date
- **Admin Control**: Can manually trigger reset job

### Credit Plans

| Plan | Monthly Credits | Price | Features |
|------|-----------------|-------|----------|
| Starter | 30,000 | $49/month | 2 AI operators, 5 concurrent calls |
| Professional | 180,000 | $199/month | 5 AI operators, 10 concurrent calls |
| Business | 720,000 | $499/month | 10 AI operators, 25 concurrent calls |
| Enterprise | Unlimited | Custom | Unlimited everything |

**Annual Billing**: 20% discount (e.g., Professional: $1,910.40/year)

### Database Tables

- `tblCreditBalances` - Per-user credit balance
- `tblCreditTransactions` - All credit movements
- `tblCreditPlans` - Available plans
- `tblSubscriptions` - Organization subscriptions
- `tblOrganizationCreditPools` - Organization-wide pool (if applicable)
- `tblBillingHistory` - Billing records

---

## PART 3: TESTING IMPLICATIONS

### Role Hierarchy Testing

**Must Verify:**
1. Regular users cannot access /admin/* routes
2. Regular users cannot call admin API endpoints
3. Admins can access all admin features
4. Admins can view all users' data
5. Regular users cannot see other users' data
6. Access denied errors are clear and informative

### Credit System Testing

**Must Verify:**
1. All users receive full allocation when plan purchased
2. Credits deducted only from user who initiated action
3. Admins can allocate credits to individual users
4. Regular users cannot see other users' balances
5. Credits expire after 365 days
6. Monthly reset works correctly
7. Balance never goes negative

### Critical Scenarios

1. **Multi-User Allocation**: Verify all users get full allocation
2. **Admin Allocation**: Verify admin can allocate to individual user
3. **Role-Based Access**: Verify access control enforcement
4. **Per-User Deduction**: Verify only user's balance affected

---

## PART 4: IMPLEMENTATION DETAILS

### Role Enforcement (Backend)

**Middleware**: `requireAdmin` in `/backend/middleware/auth.js`
```
- Checks if user.role === 'admin'
- Returns 403 Forbidden if not admin
- Allows request to proceed if admin
```

**Frontend**: `ProtectedRoute` in `/src/components/auth/ProtectedRoute.tsx`
```
- Checks if user.role matches requiredRole
- Shows "Access Denied" page if mismatch
- Displays current role in error message
```

### Credit System (Backend)

**Services**:
- `CreditService.js` - Credit operations
- `BillingService.js` - Billing operations
- `OrganizationCreditPoolService.js` - Pool management
- `CreditResetService.js` - Monthly reset and expiration

**Middleware**: `creditMiddleware.js`
- Checks if user has sufficient credits
- Blocks action if insufficient credits
- Deducts credits after action completes

---

## CONCLUSION

The Kimiya Voice platform implements a clear two-tier role system with strict access control and a hybrid credit architecture that allocates full credits to all organization users while tracking per-user usage. QA testers must verify both the role enforcement and credit system behavior to ensure data security and accurate billing.

---

**For detailed test cases, see**: `QA_TESTING_GUIDE.md`  
**For quick reference, see**: `QA_GUIDE_QUICK_INDEX.md`  
**For summary, see**: `QA_TESTING_GUIDE_SUMMARY.md`

