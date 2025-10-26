# QA Testing Guide - Quick Index

**Updated**: October 26, 2025  
**Total Tests**: 117+ test cases  
**New Content**: Role Hierarchy + Credit System Architecture

---

## DOCUMENT LOCATIONS

### Main Testing Guide
**File**: `QA_TESTING_GUIDE.md` (2,376 lines)

**Key Sections:**
- Line 1-73: Introduction & Getting Started
- Line 74-208: **NEW** User Role Hierarchy & Permissions
- Line 209-339: **NEW** Credit System Architecture
- Line 340-500: Authentication & User Management (5 tests)
- Line 501-700: Workflow Builder (4 tests)
- Line 701-900: Chat Playground (3 tests)
- Line 901-1100: Contact Management (7 tests)
- Line 1101-1300: Credit System (10 tests) **UPDATED**
- Line 1301-1500: Admin Features (7 tests)
- Line 1501-1700: Billing & Subscription (7 tests)
- Line 1701-1900: Call Testing (6 tests)
- Line 1901-2000: Navigation & UI (5 tests)
- Line 2001-2023: Advanced Testing Scenarios (5 tests)
- Line 2024-2330: **NEW** Comprehensive Role & Credit Testing (17 tests)
- Line 2331-2376: Regression Testing & Troubleshooting

### Summary Document
**File**: `QA_TESTING_GUIDE_SUMMARY.md` (513 lines)

**Key Sections:**
- Line 1-100: Overview & Document Structure
- Line 101-200: Test Execution Workflow
- Line 201-384: **NEW** User Role Hierarchy & Credit System
- Line 385-513: Testing Requirements & Scenarios

---

## ROLE HIERARCHY DOCUMENTATION

### Location in Main Guide
**Lines 74-208** in `QA_TESTING_GUIDE.md`

### What's Documented
✅ Two-tier role system (Regular User + Admin)  
✅ Feature access comparison table (15+ features)  
✅ Data visibility rules  
✅ Admin-exclusive features list  
✅ Admin-only routes (backend)  
✅ Admin-only frontend routes  

### Key Points
- Regular users: Can only see/manage own data
- Admins: Can see/manage all users' data
- 4 routes completely blocked: /admin/users, /admin/credits, /admin/billing, /admin/users/:userId/analytics
- 15+ API endpoints require admin role

---

## CREDIT SYSTEM ARCHITECTURE DOCUMENTATION

### Location in Main Guide
**Lines 209-339** in `QA_TESTING_GUIDE.md`

### What's Documented
✅ Hybrid per-user + organization-wide model  
✅ Credit allocation flow (all users get full allocation)  
✅ Credit visibility rules  
✅ Admin allocation capabilities  
✅ Credit deduction process  
✅ Credit expiration (365 days)  
✅ Billing cycle reset (monthly)  
✅ Credit plans table  
✅ Database tables involved  

### Key Points
- When plan purchased: ALL users get FULL allocation (not split)
- Example: Professional Plan (180,000 credits) with 3 users = 540,000 total
- Regular users see only own balance
- Admins see all balances + system statistics
- Credits deducted per-user

---

## ROLE HIERARCHY TESTS

### Location in Main Guide
**Lines 2024-2143** in `QA_TESTING_GUIDE.md`

### Test Suite 1: Role Hierarchy Verification (7 Tests)

| Test | Name | Priority |
|------|------|----------|
| R1 | Regular user cannot access user management | HIGH |
| R2 | Regular user cannot access credit management | HIGH |
| R3 | Regular user cannot access billing management | HIGH |
| R4 | Admin can access all admin features | HIGH |
| R5 | Admin can view all users' data | HIGH |
| R6 | Regular user cannot see other users' credit balance | HIGH |
| R7 | Admin can allocate credits to users | HIGH |

---

## CREDIT SYSTEM TESTS

### Location in Main Guide
**Lines 2144-2330** in `QA_TESTING_GUIDE.md`

### Test Suite 2: Credit System Architecture (10 Tests)

| Test | Name | Priority |
|------|------|----------|
| C1 | Per-user credit balance visibility | HIGH |
| C2 | Credit allocation to all organization users | HIGH |
| C3 | Admin manual credit allocation | HIGH |
| C4 | Real-time credit deduction during chat | HIGH |
| C5 | Per-user credit deduction (multi-user) | HIGH |
| C6 | Admin can view all credit transactions | MEDIUM |
| C7 | Regular user cannot see organization-wide credits | MEDIUM |
| C8 | Credit expiration after 365 days | MEDIUM |
| C9 | Monthly billing cycle reset | MEDIUM |
| C10 | Credit balance cannot go negative | HIGH |

---

## ADDITIONAL ROLE-BASED TESTS

### Location in Main Guide
**Lines 1548-1669** in `QA_TESTING_GUIDE.md`

### Security Testing Section (7 Tests)

| Test | Name | Lines |
|------|------|-------|
| 12.2 | Admin routes blocked for regular users | 1548-1570 |
| 12.3 | Admin-only API endpoints blocked | 1571-1600 |
| 12.4 | Admin can access all user data | 1601-1630 |
| 12.5 | Regular user cannot see other users' data | 1631-1660 |
| 12.6 | Admin can view organization billing | 1661-1690 |
| 12.7 | Regular user cannot access billing management | 1691-1720 |

---

## ADDITIONAL CREDIT SYSTEM TESTS

### Location in Main Guide
**Lines 1101-1300** in `QA_TESTING_GUIDE.md`

### Credit System Section (10 Tests)

| Test | Name | Lines |
|------|------|-------|
| 5.1 | View credit balance | 1101-1130 |
| 5.2 | View credit transactions | 1131-1160 |
| 5.3 | Real-time credit deduction during chat | 1161-1190 |
| 5.4 | Credit allocation on plan purchase | 1191-1210 |
| 5.4a | Credit allocation to all organization users | 1211-1240 |
| 5.5 | Admin credit allocation to individual user | 1241-1270 |
| 5.6 | Admin can view all users' credit balances | 1271-1290 |
| 5.7 | Regular user cannot see other users' credits | 1291-1310 |
| 5.8 | Credit deduction during chat (per-user) | 1311-1330 |
| 5.9 | Credit expiration | 1331-1350 |
| 5.10 | Monthly billing cycle reset | 1351-1370 |

---

## TEST CREDENTIALS

**Regular User**
- Email: testuser@kimiyavoice.com
- Password: TestUser123!
- Role: user
- Access: Own data only

**Admin User**
- Email: admin@kimiyavoice.com
- Password: Admin123!
- Role: admin
- Access: All data + admin features

---

## CRITICAL TESTING SCENARIOS

### Scenario 1: Multi-User Organization Credit Allocation
1. Create organization with 2 users
2. Purchase Professional Plan (180,000 credits)
3. **Verify**: Both users receive 180,000 credits each
4. **Verify**: Total organization credits = 360,000

### Scenario 2: Admin Credit Allocation
1. Login as admin
2. Allocate 50,000 bonus credits to User 1
3. **Verify**: User 1's balance increases by 50,000
4. **Verify**: User 2's balance unchanged
5. **Verify**: Transaction recorded with admin ID

### Scenario 3: Role-Based Access Control
1. Login as regular user
2. Try to access /admin/users
3. **Verify**: "Access Denied" page appears
4. **Verify**: Error message mentions admin role required
5. **Verify**: No user data is leaked

### Scenario 4: Per-User Credit Deduction
1. User 1 has 100,000 credits
2. User 2 has 100,000 credits
3. User 1 sends 10 chat messages
4. **Verify**: User 1 balance = 99,990
5. **Verify**: User 2 balance = 100,000 (unchanged)

---

## QUICK REFERENCE: WHAT'S BLOCKED FOR REGULAR USERS

### Routes Blocked (403 Forbidden)
- ❌ /admin/users
- ❌ /admin/users/:userId/analytics
- ❌ /admin/credits
- ❌ /admin/billing

### API Endpoints Blocked (403 Forbidden)
- ❌ GET /api/auth/admin/users
- ❌ GET /api/admin/credits/overview
- ❌ GET /api/admin/credits/statistics
- ❌ POST /api/admin/credits/allocate
- ❌ GET /api/admin/billing/*

### Data Blocked
- ❌ Other users' credit balances
- ❌ Other users' transaction history
- ❌ Other users' chat history
- ❌ Organization-wide credit statistics
- ❌ System-wide analytics

---

## QUICK REFERENCE: WHAT ADMINS CAN DO

### User Management
- ✅ View all users
- ✅ View user details
- ✅ View user chat history
- ✅ Activate/deactivate users
- ✅ Delete users

### Credit Management
- ✅ View all users' credit balances
- ✅ View all users' transaction history
- ✅ Allocate credits to individual users
- ✅ View system-wide credit statistics
- ✅ Trigger credit reset job
- ✅ Cleanup expired credits

### Billing Management
- ✅ View organization subscription
- ✅ View billing history
- ✅ Change organization plan
- ✅ View payment methods
- ✅ View plan change history

---

## TESTING CHECKLIST

### Phase 1: Role Hierarchy (1-2 hours)
- [ ] Complete all 7 role hierarchy tests (R1-R7)
- [ ] Complete all 6 security tests (12.2-12.7)
- [ ] Verify access control enforcement

### Phase 2: Credit System (2-3 hours)
- [ ] Complete all 10 credit system tests (C1-C10)
- [ ] Complete all 11 credit-related tests (5.1-5.10)
- [ ] Verify credit allocation and deduction

### Phase 3: Critical Scenarios (1-2 hours)
- [ ] Execute Scenario 1: Multi-user allocation
- [ ] Execute Scenario 2: Admin allocation
- [ ] Execute Scenario 3: Role-based access
- [ ] Execute Scenario 4: Per-user deduction

### Phase 4: Regression (1 hour)
- [ ] Run regression testing checklist
- [ ] Verify no existing tests broken
- [ ] Verify all features still work

---

**Total Estimated Testing Time**: 5-8 hours  
**Total Test Cases**: 34 new tests + 83 existing tests = 117+ tests

---

**For detailed test steps, see**: `QA_TESTING_GUIDE.md`  
**For overview and summary, see**: `QA_TESTING_GUIDE_SUMMARY.md`  
**For update details, see**: `QA_GUIDE_UPDATES_SUMMARY.md`

