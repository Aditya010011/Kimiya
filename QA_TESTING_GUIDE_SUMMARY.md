# QA Testing Guide - Quick Reference Summary

## Document Overview

**File**: `QA_TESTING_GUIDE.md`  
**Total Pages**: 1,562 lines  
**Sections**: 15 major testing categories  
**Test Cases**: 100+ individual test scenarios  
**Target Audience**: External QA testers with no platform knowledge

---

## What's Included in the Guide

### 1. **Getting Started** (Beginner-Friendly)
- Platform overview and purpose
- How to access the application
- Main components explanation
- Navigation guide

### 2. **Test Credentials**
- Regular user account: testuser@kimiyavoice.com / TestUser123!
- Admin account: admin@kimiyavoice.com / Admin123!
- Clear role descriptions and access levels

### 3. **Authentication & User Management** (5 Tests)
- User registration with validation
- Login/logout flows
- Profile management
- Password change functionality
- Rate limiting verification

### 4. **Workflow Builder** (4 Tests)
- Accessing the builder
- Creating workflows with nodes and connections
- Workflow activation/deactivation
- Import/export functionality
- Real-time synchronization testing

### 5. **Chat Playground Testing** (3 Tests)
- Accessing the playground
- Testing workflows with conversations
- Verifying workflow logic and branching
- Real-time credit deduction verification

### 6. **Contact Management** (7 Tests)
- CRUD operations (Create, Read, Update, Delete)
- Contact grouping and tagging
- Search and filtering
- CSV import/export
- Bulk operations

### 7. **Credit System** (4 Tests)
- Viewing credit balance and billing cycle
- Transaction history review
- Real-time credit deduction during usage
- Credit allocation on plan purchase

### 8. **Admin Features** (7 Tests)
- Admin panel access
- User management and search
- User details and chat history
- User status management
- Credit allocation
- Billing dashboard

### 9. **Billing & Subscription** (7 Tests)
- Accessing billing page
- Monthly plan purchases (Starter, Professional, Business)
- Annual plan purchases with discount verification
- Failed payment scenarios
- Billing history review
- Plan upgrades
- Stripe test card information provided

### 10. **Call Testing** (6 Tests)
- Inbound testing interface
- Call initialization
- Making test calls
- DTMF tone sending
- Call disconnection
- Call event logging

### 11. **Navigation & UI** (5 Tests)
- Main navigation verification
- Profile dropdown menu
- Responsive design testing (desktop, tablet, mobile)
- Toast notifications
- Loading states

### 12. **Advanced Testing Scenarios** (5 Tests)
- Multi-user real-time synchronization
- Concurrent credit deduction
- Complex workflow branching
- Large contact import (500+ contacts)
- Credit expiration and renewal

### 13. **Performance & Stress Testing** (3 Tests)
- Workflow builder with 20+ nodes
- Chat playground with 50+ messages
- Contact list with 1000+ contacts

### 14. **Security Testing** (4 Tests)
- Protected routes verification
- Role-based access control
- Password security
- Rate limiting for brute force prevention

### 15. **Data Integrity Testing** (3 Tests)
- Workflow data persistence
- Contact data integrity
- Credit transaction accuracy

### 16. **Edge Case Testing** (4 Tests)
- Empty workflow execution
- Very long contact names
- Special characters and unicode
- Rapid consecutive saves
- Zero credit balance behavior

### 17. **Browser Compatibility** (4 Tests)
- Chrome
- Firefox
- Safari
- Edge

### 18. **Regression Testing Checklist**
- 10-item checklist for post-deployment verification

---

## Key Features of This Guide

✅ **Beginner-Friendly**: No prior platform knowledge required  
✅ **Step-by-Step Instructions**: Every test has numbered steps  
✅ **Clear Expected Results**: Checkbox format for easy tracking  
✅ **Test Credentials Provided**: Ready-to-use accounts  
✅ **Stripe Test Cards**: Included for payment testing  
✅ **Troubleshooting Section**: Common issues and solutions  
✅ **Comprehensive Coverage**: 100+ test scenarios  
✅ **Priority Levels**: Tests marked as HIGH/MEDIUM/LOW priority  
✅ **Real-World Scenarios**: Tests based on actual user workflows  
✅ **Performance Testing**: Stress tests included  
✅ **Security Testing**: Verification of access controls  
✅ **Browser Compatibility**: Multi-browser testing  
✅ **Bug Reporting Template**: Guidelines for reporting issues  

---

## How to Use This Guide

### For New Testers
1. Start with "Getting Started" section
2. Review "Test Credentials" section
3. Begin with HIGH priority tests
4. Use the checklist to track progress

### For Experienced Testers
1. Jump to specific sections as needed
2. Use the Table of Contents for navigation
3. Reference troubleshooting for common issues
4. Follow regression testing checklist after updates

### For Test Execution
1. Open the guide in a text editor or browser
2. Use the checkbox format to mark completed tests
3. Take screenshots for failed tests
4. Document any issues found
5. Use bug reporting template for issues

---

## Test Execution Workflow

### Phase 1: Authentication (1-2 hours)
- Complete all authentication tests
- Verify user roles work correctly
- Test rate limiting

### Phase 2: Core Features (4-6 hours)
- Workflow builder tests
- Chat playground tests
- Contact management tests
- Credit system tests

### Phase 3: Billing & Admin (2-3 hours)
- Billing and subscription tests
- Admin feature tests
- User management tests

### Phase 4: Advanced Testing (2-3 hours)
- Performance testing
- Security testing
- Data integrity testing
- Edge case testing

### Phase 5: Browser & Regression (1-2 hours)
- Browser compatibility tests
- Regression testing checklist
- Final verification

---

## Test Credentials Summary

| Account | Email | Password | Role | Purpose |
|---------|-------|----------|------|---------|
| Regular User | testuser@kimiyavoice.com | TestUser123! | User | General feature testing |
| Admin | admin@kimiyavoice.com | Admin123! | Admin | Admin feature testing |

---

## USER ROLE HIERARCHY

### Two-Tier Role System

**Regular User (Default)**
- Access to core features (Dashboard, Workflows, Chat, Contacts)
- Can only view/manage own data
- Cannot access admin panel
- Cannot manage other users
- Cannot allocate credits

**Admin (Elevated)**
- Access to all features including admin panel
- Can view/manage all users
- Can allocate credits to users
- Can manage organization billing
- Can view system-wide statistics

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

### Admin-Only Routes (Completely Blocked for Regular Users)

- `/admin/users` - User Management
- `/admin/users/:userId/analytics` - User Analytics
- `/admin/credits` - Credit Management
- `/admin/billing` - Billing Management

**Access Denied Response**: Regular users attempting to access these routes will see an "Access Denied" page stating they need admin role.

---

## CREDIT SYSTEM ARCHITECTURE

### Model: Hybrid Per-User + Organization-Wide

**Key Concept**: Each user has their own credit balance, but credits are allocated at the organization level.

### Credit Allocation Flow

1. **Organization purchases plan** (e.g., Professional = 180,000 credits/month)
2. **Credits allocated to ALL users** in organization
3. **Each user receives FULL allocation** (not split)
4. **Example**: 3 users in organization, Professional Plan purchased
   - User 1: 180,000 credits
   - User 2: 180,000 credits
   - User 3: 180,000 credits
   - **Total**: 540,000 credits

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
- ✅ System-wide statistics
- ✅ Usage by service type
- ✅ Users with low/high usage

### Admin Credit Allocation

**Admins can manually allocate credits to individual users:**

- **Types**: top_up, bonus, refund, adjustment
- **Process**: Admin Panel > Credit Management > Select User > Allocate
- **Immediate Effect**: User's balance increases/decreases immediately
- **Recorded**: Transaction history shows allocation with reason and admin ID

**Example Scenarios:**
- User runs out of credits: Admin allocates 50,000 bonus credits
- User overcharged: Admin allocates -10,000 refund credits
- Promotional offer: Admin allocates 100,000 bonus credits

### Credit Deduction

**Automatic deduction for:**
- Chat messages: 1 credit per message
- Call time: 1 credit per second
- Storage: Credits per MB per month
- Transcription: Credits per minute
- AI services: Credits per operation

**Deduction is per-user**: Only the user who initiated the action has credits deducted.

### Credit Expiration & Reset

- **Expiration**: 365 days (1 year)
- **Monthly Reset**: Resets on subscription renewal date
- **Admin Control**: Can manually trigger cleanup and reset jobs

---

## ROLE-BASED TESTING REQUIREMENTS

### Tests for Role Hierarchy (7 tests)

1. ✅ Regular user cannot access /admin/users
2. ✅ Regular user cannot access /admin/credits
3. ✅ Regular user cannot access /admin/billing
4. ✅ Regular user cannot call admin API endpoints
5. ✅ Admin can access all user data
6. ✅ Admin can view organization billing
7. ✅ Regular user cannot see other users' data

### Tests for Credit System (10 tests)

1. ✅ View own credit balance
2. ✅ View own transaction history
3. ✅ Real-time credit deduction during chat
4. ✅ Credit allocation on plan purchase
5. ✅ Credits allocated to ALL organization users
6. ✅ Admin can allocate credits to individual user
7. ✅ Admin can view all users' credit balances
8. ✅ Regular user cannot see other users' credits
9. ✅ Credit expiration after 365 days
10. ✅ Monthly billing cycle reset

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

## Stripe Test Cards

| Scenario | Card Number | Expiry | CVC |
|----------|-------------|--------|-----|
| Successful Payment | 4242 4242 4242 4242 | 12/25 | 123 |
| Declined Card | 4000 0000 0000 0002 | 12/25 | 123 |
| Requires Auth | 4000 0025 0000 3155 | 12/25 | 123 |

---

## Priority Levels

### HIGH Priority (Test First)
- Authentication & User Management
- Workflow Builder
- Chat Playground
- Credit System
- Billing & Subscription

### MEDIUM Priority (Test Second)
- Contact Management
- Admin Features
- Call Testing
- Navigation & UI

### LOW Priority (Test Last)
- Browser Compatibility
- Performance Testing
- Edge Cases
- Advanced Scenarios

---

## Common Test Scenarios

### Scenario 1: New User Onboarding
1. Register new account
2. Login
3. Create first workflow
4. Test workflow in chat playground
5. View credit balance
6. Purchase credits

### Scenario 2: Admin User Management
1. Login as admin
2. View all users
3. Search for specific user
4. View user details and chat history
5. Allocate credits to user
6. Deactivate user

### Scenario 3: Contact Management Workflow
1. Create contact
2. Assign to group
3. Add tags
4. Export contacts
5. Import updated contacts
6. Verify data integrity

### Scenario 4: Billing Workflow
1. View current plan
2. Upgrade to higher plan
3. Complete payment
4. Verify credits allocated
5. View billing history
6. Check transaction records

---

## Expected Test Duration

| Section | Duration | Tests |
|---------|----------|-------|
| Authentication | 1-2 hours | 5 |
| Workflow Builder | 2-3 hours | 4 |
| Chat Playground | 1-2 hours | 3 |
| Contact Management | 1-2 hours | 7 |
| Credit System | 1-2 hours | 4 |
| Admin Features | 1-2 hours | 7 |
| Billing | 2-3 hours | 7 |
| Call Testing | 1-2 hours | 6 |
| Navigation & UI | 1 hour | 5 |
| Advanced/Performance | 2-3 hours | 12 |
| Security/Data/Edge Cases | 2-3 hours | 11 |
| Browser Compatibility | 1-2 hours | 4 |
| **Total** | **18-30 hours** | **100+** |

---

## Success Criteria

All tests should be marked as PASSED when:
- ✅ All expected results are achieved
- ✅ No critical bugs are found
- ✅ No console errors appear
- ✅ Performance is acceptable
- ✅ Data integrity is maintained
- ✅ Security controls are enforced

---

## Next Steps After Testing

1. **Document Results**: Record all test results
2. **Report Bugs**: Use provided bug reporting template
3. **Prioritize Issues**: Categorize by severity
4. **Retest Fixes**: Verify bug fixes work
5. **Sign Off**: Confirm platform is ready for release

---

## Support & Questions

For questions about:
- **Test Execution**: Refer to specific test section
- **Troubleshooting**: See Troubleshooting section
- **Bug Reporting**: See Bug Reporting Guidelines
- **Platform Features**: See Feature Analysis document

---

**Document Version**: 1.0  
**Created**: October 26, 2025  
**For**: External QA Testing Team  
**Main Guide**: QA_TESTING_GUIDE.md (1,562 lines)

