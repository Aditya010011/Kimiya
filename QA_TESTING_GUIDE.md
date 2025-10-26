# Kimiya Voice Platform - QA Testing Guide

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Target Audience**: QA Testers with no prior platform knowledge  
**Testing Environment**: https://dev-ai-phone-call.kimiyi.ai

---

## TABLE OF CONTENTS

1. [Getting Started](#getting-started)
2. [Test Credentials](#test-credentials)
3. [Authentication & User Management](#authentication--user-management)
4. [Workflow Builder](#workflow-builder)
5. [Chat Playground Testing](#chat-playground-testing)
6. [Contact Management](#contact-management)
7. [Credit System](#credit-system)
8. [Admin Features](#admin-features)
9. [Billing & Subscription](#billing--subscription)
10. [Call Testing](#call-testing)
11. [Navigation & UI](#navigation--ui)
12. [Troubleshooting](#troubleshooting)

---

## GETTING STARTED

### What is Kimiya Voice?

Kimiya Voice is an AI-powered phone call platform that allows users to:
- Create automated voice workflows using a visual builder
- Make and receive phone calls with AI agents
- Manage contacts and organize communication
- Track usage through a credit-based system
- Manage billing and subscriptions

### Platform Overview

**Main Components:**
- **Dashboard**: View and manage workflows
- **Workflow Builder**: Create automated call flows
- **Chat Playground**: Test workflows with simulated conversations
- **Contacts**: Manage and organize contacts
- **Credits**: Track usage and billing
- **Admin Panel**: User and billing management (admin only)

### Accessing the Platform

1. Navigate to: https://dev-ai-phone-call.kimiyi.ai
2. You will be redirected to the login page
3. Enter your test credentials (see Test Credentials section)
4. Click "Login"
5. You will be taken to the Dashboard

---

## TEST CREDENTIALS

### Regular User Account
- **Email**: testuser@kimiyavoice.com
- **Password**: TestUser123!
- **Role**: Regular User
- **Access**: Dashboard, Workflow Builder, Chat Playground, Contacts, Credits (own only)

### Admin Account
- **Email**: admin@kimiyavoice.com
- **Password**: Admin123!
- **Role**: Administrator
- **Access**: All features + Admin Panel (User Management, Billing, Credit Allocation)

---

## USER ROLE HIERARCHY & PERMISSIONS

### Role Hierarchy Overview

The Kimiya Voice platform has a **two-tier role hierarchy**:

1. **Regular User** (Default role)
   - Can access core platform features
   - Can only view/manage their own data
   - Cannot access admin features
   - Cannot manage other users
   - Cannot allocate credits to other users

2. **Admin** (Elevated role)
   - Can access all features including admin panel
   - Can view and manage all users in the organization
   - Can allocate credits to users
   - Can manage billing and subscriptions
   - Can view system-wide analytics and statistics
   - Can manage credit plans and billing

### Feature Access Comparison Table

| Feature | Regular User | Admin |
|---------|--------------|-------|
| **Dashboard** | ✅ Own workflows | ✅ All workflows |
| **Workflow Builder** | ✅ Create/edit own | ✅ Create/edit own |
| **Chat Playground** | ✅ Test own workflows | ✅ Test own workflows |
| **Contacts** | ✅ Own contacts | ✅ Own contacts |
| **Credit Dashboard** | ✅ Own balance only | ✅ Own balance only |
| **Credit Transactions** | ✅ Own transactions | ✅ Own transactions |
| **User Management** | ❌ NOT AVAILABLE | ✅ View all users |
| **User Details** | ❌ NOT AVAILABLE | ✅ View any user's details |
| **User Chat History** | ❌ NOT AVAILABLE | ✅ View any user's chat history |
| **User Status Management** | ❌ NOT AVAILABLE | ✅ Activate/deactivate users |
| **Admin Credit Allocation** | ❌ NOT AVAILABLE | ✅ Allocate credits to users |
| **Admin Credit Overview** | ❌ NOT AVAILABLE | ✅ View system-wide credit stats |
| **Admin Billing Dashboard** | ❌ NOT AVAILABLE | ✅ Manage organization billing |
| **Plan Management** | ❌ NOT AVAILABLE | ✅ View/manage credit plans |
| **Billing History** | ❌ NOT AVAILABLE | ✅ View organization billing history |
| **Inbound Testing** | ✅ Available | ✅ Available |

### Data Visibility Rules

**Regular Users:**
- Can only view their own credit balance
- Can only view their own transaction history
- Can only view their own workflows
- Can only view their own contacts
- Cannot see other users' data

**Admins:**
- Can view their own credit balance
- Can view their own transaction history
- Can view all users' credit balances (via admin panel)
- Can view all users' transaction history (via admin panel)
- Can view all users' details and activity
- Can view system-wide statistics

---

## ADMIN-EXCLUSIVE FEATURES

### Complete List of Admin-Only Features

The following features are **COMPLETELY UNAVAILABLE** to regular users:

1. **User Management** (`/admin/users`)
   - View all users in organization
   - Search and filter users
   - View user details (name, email, role, status, creation date)
   - View user activity metrics (workflow count, active sessions, last login)
   - Activate/deactivate user accounts
   - Delete user accounts

2. **User Analytics** (`/admin/users/:userId/analytics`)
   - View individual user's chat history
   - View user's conversation analytics
   - View user's usage patterns
   - View user's workflow activity

3. **Admin Credit Management** (`/admin/credits`)
   - Allocate credits to individual users
   - View system-wide credit overview
   - View credit statistics (total allocated, used, remaining)
   - View users with low balance
   - View users with high usage
   - View top users by credit usage
   - View usage breakdown by service type
   - View recent credit allocations
   - Manually trigger credit reset job
   - Manually trigger expired credits cleanup

4. **Admin Billing Management** (`/admin/billing`)
   - View organization subscription details
   - View all credit plans
   - View billing history for organization
   - Manage organization subscription
   - View payment methods
   - Change organization plan
   - View plan change history

5. **System Monitoring** (Admin-only endpoints)
   - View session statistics
   - View system health metrics
   - Access admin-only API endpoints

### Admin-Only Routes (Backend)

The following routes require `admin` role and will return **403 Forbidden** for regular users:

- `GET /api/auth/admin/users` - Get all users
- `GET /api/auth/admin/users/:userId` - Get specific user details
- `GET /api/auth/admin/users/:userId/analytics` - Get user analytics
- `POST /api/auth/admin/users/:userId/activate` - Activate user
- `POST /api/auth/admin/users/:userId/deactivate` - Deactivate user
- `DELETE /api/auth/admin/users/:userId` - Delete user
- `GET /api/admin/credits/overview` - Get credit overview
- `GET /api/admin/credits/statistics` - Get credit statistics
- `POST /api/admin/credits/allocate` - Allocate credits to user
- `POST /api/admin/credits/run-reset-job` - Trigger credit reset
- `POST /api/admin/credits/cleanup-expired` - Cleanup expired credits
- `GET /api/admin/billing/*` - All billing management endpoints

### Admin-Only Frontend Routes

The following routes are protected with `requiredRole="admin"` and will show "Access Denied" page:

- `/admin/users` - User Management
- `/admin/users/:userId/analytics` - User Analytics
- `/admin/credits` - Admin Credit Management
- `/admin/billing` - Admin Billing Management

---

## CREDIT SYSTEM ARCHITECTURE

### Overview

The Kimiya Voice credit system uses a **hybrid per-user + organization-wide model**:

- **Per-User Credit Balances**: Each user has their own individual credit balance
- **Organization-Wide Subscriptions**: Credits are allocated to the organization, then distributed to users
- **Shared Organization Pool**: All users in an organization share the same subscription plan

### Credit Allocation Model

**When a Plan is Purchased:**

1. Organization purchases a plan (e.g., Professional Plan = 180,000 credits/month)
2. Credits are allocated to **ALL users in the organization** equally
3. Each user receives the full monthly allocation (not split)
4. Example: If Professional Plan has 180,000 credits/month and organization has 3 users:
   - User 1 receives: 180,000 credits
   - User 2 receives: 180,000 credits
   - User 3 receives: 180,000 credits
   - **Total organization credits**: 540,000 credits

### Credit Visibility

**Regular Users:**
- Can see **only their own credit balance**
- Can see **only their own transaction history**
- Cannot see other users' credit balances
- Cannot see organization-wide credit pool
- Cannot see total organization credits

**Admins:**
- Can see **their own credit balance**
- Can see **their own transaction history**
- Can see **all users' credit balances** (via admin panel)
- Can see **all users' transaction history** (via admin panel)
- Can see **system-wide credit statistics**:
  - Total credits allocated across all users
  - Total credits used across all users
  - Total credits remaining across all users
  - Users with low balance
  - Users with high usage
  - Usage breakdown by service type

### Admin Credit Allocation Capabilities

**Admins can manually allocate credits to individual users:**

- **Allocation Types**: top_up, bonus, refund, adjustment
- **Allocation Process**:
  1. Admin goes to Admin Panel > Credit Management
  2. Selects a user
  3. Enters amount to allocate
  4. Enters reason/notes
  5. Clicks "Allocate"
  6. Credits are added to user's balance immediately
  7. Transaction is recorded in user's transaction history

**Example Scenarios:**

- **Scenario 1**: User runs out of credits mid-month
  - Admin allocates 50,000 bonus credits to user
  - User's balance increases by 50,000
  - Transaction recorded as "bonus" type

- **Scenario 2**: User was overcharged
  - Admin allocates -10,000 credits (refund)
  - User's balance decreases by 10,000
  - Transaction recorded as "refund" type

- **Scenario 3**: Promotional credit
  - Admin allocates 100,000 credits to new user
  - User's balance increases by 100,000
  - Transaction recorded as "bonus" type

### Credit Deduction

**Credits are deducted automatically for:**

1. **Chat Messages**: 1 credit per message
2. **Call Time**: 1 credit per second of call time
3. **Storage**: Credits per MB per month
4. **Transcription**: Credits per minute of transcription
5. **AI Services**: Credits for summaries and analysis

**Deduction Process:**
- User initiates action (send chat message, make call, etc.)
- System checks if user has sufficient credits
- If yes: Action proceeds, credits are deducted, transaction recorded
- If no: Action is blocked, user is prompted to purchase more credits

### Credit Expiration

- Credits expire after **365 days** (1 year)
- Expired credits are automatically cleaned up
- Admins can manually trigger cleanup via admin panel
- New credits allocated on plan purchase reset the expiration date

### Billing Cycle Reset

- Credits reset **monthly** on the subscription renewal date
- Monthly usage counter resets to 0
- New monthly allocation is applied
- Admins can manually trigger reset job for testing

### Credit Plans

| Plan | Monthly Credits | Price | Features |
|------|-----------------|-------|----------|
| Starter | 30,000 | $49/month | 2 AI operators, 5 concurrent calls, 5 campaigns/month, 2,000 messages |
| Professional | 180,000 | $199/month | 5 AI operators, 10 concurrent calls, 20 campaigns/month, 10,000 messages |
| Business | 720,000 | $499/month | 10 AI operators, 25 concurrent calls, 50 campaigns/month, 50,000 messages |
| Enterprise | Unlimited | Custom | Unlimited everything |

**Annual Billing**: 20% discount on annual plans (e.g., Professional: $1,910.40/year instead of $2,388)

### Credit System Database Tables

- **tblCreditBalances**: Stores per-user credit balance
- **tblCreditTransactions**: Records all credit movements
- **tblCreditPlans**: Available subscription plans
- **tblSubscriptions**: Organization subscriptions
- **tblOrganizationCreditPools**: Organization-wide credit pool (if applicable)
- **tblBillingHistory**: Billing records

---

## AUTHENTICATION & USER MANAGEMENT

### Priority: HIGH

#### Test 1.1: User Registration
**Steps:**
1. Navigate to https://dev-ai-phone-call.kimiyi.ai
2. Click "Sign Up" or "Create Account" link
3. Enter a new email address (e.g., testqa+[timestamp]@kimiyavoice.com)
4. Enter a password (minimum 8 characters, must include uppercase, lowercase, number, special character)
5. Confirm password
6. Click "Register"

**Expected Results:**
- [ ] Registration form accepts valid input
- [ ] Error message appears if password doesn't meet requirements
- [ ] Success message appears after registration
- [ ] User is redirected to login page or dashboard
- [ ] New account can be used to login

**Rate Limiting Test:**
- Attempt to register 6 times within 15 minutes
- [ ] 6th attempt should be blocked with rate limit message

---

#### Test 1.2: User Login
**Steps:**
1. Navigate to login page
2. Enter email: testuser@kimiyavoice.com
3. Enter password: TestUser123!
4. Click "Login"

**Expected Results:**
- [ ] Login succeeds with correct credentials
- [ ] User is redirected to Dashboard
- [ ] JWT token is generated (visible in browser DevTools > Application > Cookies)
- [ ] User name appears in profile dropdown (top right)

**Negative Test:**
- [ ] Login fails with incorrect password (error message displayed)
- [ ] Login fails with non-existent email (error message displayed)

**Rate Limiting Test:**
- Attempt to login 11 times within 15 minutes with wrong password
- [ ] 11th attempt should be blocked with rate limit message

---

#### Test 1.3: User Logout
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click profile icon (top right)
3. Click "Logout"

**Expected Results:**
- [ ] User is logged out
- [ ] Redirected to login page
- [ ] JWT token is removed from cookies
- [ ] Cannot access protected pages without re-logging in

---

#### Test 1.4: Profile Management
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click profile icon (top right)
3. Click "Profile"
4. View profile information (name, email, etc.)
5. Edit name field to "QA Tester Updated"
6. Click "Save Changes"

**Expected Results:**
- [ ] Profile page loads with current user information
- [ ] Name field is editable
- [ ] Changes are saved successfully
- [ ] Success message appears
- [ ] Updated name appears in profile dropdown after refresh

---

#### Test 1.5: Password Change
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click profile icon > "Profile"
3. Scroll to "Change Password" section
4. Enter current password: TestUser123!
5. Enter new password: NewPassword123!
6. Confirm new password: NewPassword123!
7. Click "Change Password"

**Expected Results:**
- [ ] Password change succeeds
- [ ] Success message appears
- [ ] Can login with new password on next session
- [ ] Old password no longer works

---

## WORKFLOW BUILDER

### Priority: HIGH

#### Test 2.1: Access Workflow Builder
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click "Dashboard" in navigation
3. Click "Create New Workflow" or "+" button
4. OR click on existing workflow to edit

**Expected Results:**
- [ ] Workflow builder page loads
- [ ] Visual canvas is displayed with grid
- [ ] Component library panel is visible on left side
- [ ] Configuration panel is visible on right side
- [ ] Toolbar with save, export, import buttons is visible

---

#### Test 2.2: Create a Simple Test Workflow
**Steps:**
1. In Workflow Builder, drag "Start" node from component library to canvas
2. Drag "Conversation" node to canvas
3. Connect Start node to Conversation node (drag from output port to input port)
4. Click on Conversation node to configure
5. In configuration panel, enter:
   - **System Prompt**: "You are a helpful assistant"
   - **Initial Message**: "Hello, how can I help you today?"
6. Drag "End Call" node to canvas
7. Connect Conversation node to End Call node
8. Click "Save Workflow"
9. Enter workflow name: "QA Test Workflow [timestamp]"
10. Click "Save"

**Expected Results:**
- [ ] Nodes can be dragged to canvas
- [ ] Nodes can be connected with edges
- [ ] Configuration panel updates when node is selected
- [ ] Workflow saves successfully
- [ ] Success message appears
- [ ] Workflow appears in Dashboard list

**Real-time Persistence Test:**
1. Open the same workflow in two browser tabs
2. In Tab 1, add a new node and save
3. In Tab 2, refresh the page
- [ ] New node appears in Tab 2 (real-time sync verified)

---

#### Test 2.3: Workflow Activation/Deactivation
**Steps:**
1. Go to Dashboard
2. Find "QA Test Workflow" in the list
3. Click the toggle/switch to activate workflow
4. Verify status changes to "Active"
5. Click toggle again to deactivate
6. Verify status changes to "Inactive"

**Expected Results:**
- [ ] Workflow activation toggle works
- [ ] Status updates immediately
- [ ] Active workflows are marked visually (different color/icon)
- [ ] Inactive workflows cannot be used for calls/chat

---

#### Test 2.4: Workflow Import/Export
**Steps:**
1. Go to Dashboard
2. Click on "QA Test Workflow"
3. Click "Export" button
4. Save the JSON file to your computer
5. Go back to Dashboard
6. Click "Import Workflow"
7. Select the JSON file you just downloaded
8. Enter new workflow name: "QA Test Workflow Imported"
9. Click "Import"

**Expected Results:**
- [ ] Export creates a valid JSON file
- [ ] Imported workflow appears in Dashboard
- [ ] Imported workflow has same structure as original
- [ ] All nodes and connections are preserved

---

## CHAT PLAYGROUND TESTING

### Priority: HIGH

#### Test 3.1: Access Chat Playground
**Steps:**
1. Go to Dashboard
2. Click on "QA Test Workflow"
3. Click "Test in Playground" or "Chat" button

**Expected Results:**
- [ ] Chat playground interface loads
- [ ] Chat message input field is visible
- [ ] Workflow is ready for testing
- [ ] Initial message from workflow appears (if configured)

---

#### Test 3.2: Test Workflow with Chat
**Steps:**
1. In Chat Playground for "QA Test Workflow"
2. Type a test message: "Hello, can you help me?"
3. Press Enter or click Send
4. Wait for AI response

**Expected Results:**
- [ ] Message appears in chat as "User" message
- [ ] AI response appears after a few seconds
- [ ] Response follows the workflow logic
- [ ] Chat history is maintained in the conversation
- [ ] Multiple messages can be sent in sequence

**Credit Deduction Test:**
1. Note current credit balance from Dashboard
2. Have a 5-message conversation in Chat Playground
3. Go back to Dashboard
4. Check Credit Dashboard
- [ ] Credits have been deducted
- [ ] Deduction amount is reasonable for the conversation length

---

#### Test 3.3: Workflow Logic Verification
**Steps:**
1. Create a workflow with conditional branching:
   - Start node
   - Conversation node asking "Are you interested in our service? (yes/no)"
   - Two branches: one for "yes", one for "no"
   - Different responses for each branch
2. Save and activate workflow
3. Test in Chat Playground
4. Send "yes" response
5. Verify correct branch is followed
6. Test again with "no" response

**Expected Results:**
- [ ] Workflow follows correct branch based on input
- [ ] Conditional logic works as designed
- [ ] Different responses appear for different inputs

---

## CONTACT MANAGEMENT

### Priority: MEDIUM

#### Test 4.1: Create Contact
**Steps:**
1. Click "Contacts" in navigation
2. Click "Add Contact" or "+" button
3. Fill in contact information:
   - **Name**: QA Test Contact
   - **Email**: qatest@example.com
   - **Phone**: +1-555-0123
   - **Company**: QA Testing Inc
4. Click "Save Contact"

**Expected Results:**
- [ ] Contact form displays all fields
- [ ] Contact is saved successfully
- [ ] Success message appears
- [ ] New contact appears in contacts list

---

#### Test 4.2: Edit Contact
**Steps:**
1. In Contacts list, click on "QA Test Contact"
2. Click "Edit" button
3. Change email to: qatest.updated@example.com
4. Click "Save"

**Expected Results:**
- [ ] Contact details page loads
- [ ] Edit mode allows field modification
- [ ] Changes are saved
- [ ] Updated information appears in contact list

---

#### Test 4.3: Delete Contact
**Steps:**
1. In Contacts list, find "QA Test Contact"
2. Click delete icon or "Delete" button
3. Confirm deletion in popup

**Expected Results:**
- [ ] Confirmation dialog appears
- [ ] Contact is deleted after confirmation
- [ ] Contact no longer appears in list
- [ ] Success message appears

---

#### Test 4.4: Contact Groups
**Steps:**
1. In Contacts, click "Groups" or "Manage Groups"
2. Click "Create Group"
3. Enter group name: "QA Test Group"
4. Select color (e.g., blue)
5. Click "Create"
6. Create another contact: "QA Contact 2"
7. Assign both contacts to "QA Test Group"
8. Filter contacts by group

**Expected Results:**
- [ ] Group is created successfully
- [ ] Contacts can be assigned to groups
- [ ] Group filter shows only contacts in that group
- [ ] Group color is displayed

---

#### Test 4.5: Contact Tags
**Steps:**
1. In Contacts, click "Tags" or "Manage Tags"
2. Click "Create Tag"
3. Enter tag name: "VIP"
4. Select color (e.g., red)
5. Click "Create"
6. Assign tag to "QA Test Contact"
7. Filter by tag

**Expected Results:**
- [ ] Tag is created successfully
- [ ] Tags can be assigned to contacts
- [ ] Tag filter works correctly
- [ ] Multiple tags can be assigned to one contact

---

#### Test 4.6: Contact Search & Filter
**Steps:**
1. In Contacts list, use search box
2. Search for "QA Test"
3. Verify results show matching contacts
4. Use filter dropdown to filter by group
5. Use filter dropdown to filter by tag

**Expected Results:**
- [ ] Search returns relevant results
- [ ] Search is case-insensitive
- [ ] Group filter works
- [ ] Tag filter works
- [ ] Multiple filters can be applied together

---

#### Test 4.7: CSV Import/Export
**Steps:**
1. In Contacts, click "Export" button
2. Select "CSV" format
3. Save file to computer
4. Open CSV file in spreadsheet application
5. Verify all contact data is present
6. Add a new row with test data
7. Save CSV file
8. In Contacts, click "Import"
9. Select the modified CSV file
10. Map columns to contact fields
11. Click "Import"

**Expected Results:**
- [ ] Export creates valid CSV file
- [ ] CSV contains all contact fields
- [ ] Import accepts CSV file
- [ ] New contacts from CSV appear in list
- [ ] Existing contacts are not duplicated

---

## CREDIT SYSTEM

### Priority: HIGH

#### Test 5.1: View Credit Balance
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click "Credits" in navigation or profile dropdown
3. View Credit Dashboard

**Expected Results:**
- [ ] Credit Dashboard loads
- [ ] Current credit balance is displayed prominently
- [ ] Billing cycle information is shown (e.g., "25 days remaining")
- [ ] Plan information is displayed (e.g., "Professional Plan")
- [ ] Next billing date is shown

---

#### Test 5.2: View Credit Transactions
**Steps:**
1. In Credit Dashboard, scroll to "Transaction History"
2. View list of all credit transactions
3. Click on a transaction to see details

**Expected Results:**
- [ ] Transaction history displays all credit movements
- [ ] Each transaction shows:
  - [ ] Date and time
  - [ ] Type (allocation, deduction, refund, adjustment)
  - [ ] Amount
  - [ ] Description/reason
  - [ ] Running balance
- [ ] Transactions are sorted by date (newest first)
- [ ] Pagination works if many transactions exist

---

#### Test 5.3: Real-time Credit Deduction During Chat
**Steps:**
1. Note current credit balance
2. Open Chat Playground
3. Have a conversation with 10+ messages
4. Return to Credit Dashboard
5. Refresh page

**Expected Results:**
- [ ] Credits are deducted after each message
- [ ] Deduction amount is consistent
- [ ] Credit balance updates in real-time
- [ ] Transaction history shows new deductions
- [ ] Balance never goes negative (if limit enforced)

---

#### Test 5.4: Credit Allocation on Plan Purchase
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Go to Credits > "Upgrade Plan" or "Purchase Credits"
3. Select "Professional Plan" (180,000 credits/month)
4. Complete purchase (see Billing section for details)
5. Return to Credit Dashboard

**Expected Results:**
- [ ] Credits are allocated immediately after purchase
- [ ] New balance reflects allocated credits (180,000 for Professional Plan)
- [ ] Transaction history shows allocation entry
- [ ] Billing cycle reset date is set to first day of next month
- [ ] All users in organization receive same allocation (180,000 each)

---

#### Test 5.4a: Credit Allocation to All Organization Users
**Objective**: Verify credits are allocated to ALL users when plan is purchased

**Steps:**
1. Have 2+ users in same organization
2. Login as admin@kimiyavoice.com
3. Note current credit balance for User 1 and User 2
4. Go to Billing > Purchase Professional Plan
5. Complete payment
6. Go to Admin Panel > Credit Management
7. Check credit balance for User 1
8. Check credit balance for User 2

**Expected Results:**
- [ ] User 1 receives 180,000 credits
- [ ] User 2 receives 180,000 credits
- [ ] Both users receive FULL allocation (not split)
- [ ] Both users' transaction history shows allocation
- [ ] Both users' billing cycle reset date is updated

---

### Test 5.5: Admin Credit Allocation to Individual User
**Steps:**
1. Login as admin@kimiyavoice.com
2. Go to Admin Panel > Credit Management
3. Find testuser@kimiyavoice.com
4. Click "Allocate Credits"
5. Enter amount: 50000
6. Enter reason: "QA Testing Bonus"
7. Click "Allocate"
8. Verify success message

**Expected Results:**
- [ ] Credit allocation succeeds
- [ ] User's balance increases by 50,000
- [ ] Transaction history shows new allocation entry
- [ ] Transaction type shows as "allocation" or "bonus"
- [ ] Reason/notes are recorded
- [ ] Admin user ID is recorded as "allocated_by"
- [ ] Timestamp is recorded

---

### Test 5.6: Admin Can View All Users' Credit Balances
**Steps:**
1. Login as admin@kimiyavoice.com
2. Go to Admin Panel > Credit Management
3. View credit overview

**Expected Results:**
- [ ] Admin can see all users' credit balances
- [ ] Admin can see total credits allocated across all users
- [ ] Admin can see total credits used across all users
- [ ] Admin can see total credits remaining across all users
- [ ] Admin can see users with low balance (< 10% of monthly allocation)
- [ ] Admin can see users with high usage (> 80% of monthly allocation)
- [ ] Admin can see usage breakdown by service type (chat, calls, storage, etc.)
- [ ] Admin can see recent allocations

---

### Test 5.7: Regular User Cannot See Other Users' Credits
**Steps:**
1. Login as testuser@kimiyavoice.com (regular user)
2. Try to access /api/credits/balance/2 (different user)
3. Try to access /api/admin/credits/overview
4. Check if admin credit management appears in UI

**Expected Results:**
- [ ] API returns 403 Forbidden for other user's balance
- [ ] Error message: "You can only view your own credit balance"
- [ ] /api/admin/credits/overview returns 403 Forbidden
- [ ] Admin credit management does NOT appear in UI
- [ ] Regular user can only see their own balance

---

### Test 5.8: Credit Deduction During Chat (Per-User)
**Objective**: Verify credits are deducted from individual user's balance

**Steps:**
1. Login as testuser@kimiyavoice.com
2. Note current credit balance: X
3. Open Chat Playground
4. Send 10 messages
5. Return to Credit Dashboard
6. Note new balance: Y

**Expected Results:**
- [ ] Credits are deducted from testuser's balance only
- [ ] Deduction = 10 credits (1 per message)
- [ ] New balance = X - 10
- [ ] Transaction history shows 10 deduction entries
- [ ] Each transaction shows service_type: "chat"
- [ ] Other users' balances are NOT affected

---

### Test 5.9: Credit Expiration
**Objective**: Verify credits expire after 365 days

**Steps:**
1. Login as admin@kimiyavoice.com
2. Allocate 100,000 credits to testuser with expiration date 365 days ago
3. Go to Admin Panel > Credit Management
4. Click "Cleanup Expired Credits"
5. Check testuser's balance

**Expected Results:**
- [ ] Expired credits are removed from balance
- [ ] Transaction history shows expiration entry
- [ ] User is notified of expired credits (if applicable)
- [ ] Non-expired credits remain in balance

---

### Test 5.10: Monthly Billing Cycle Reset
**Objective**: Verify credits reset monthly

**Steps:**
1. Login as admin@kimiyavoice.com
2. Note current monthly_used and monthly_allocation
3. Go to Admin Panel > Credit Management
4. Click "Run Monthly Reset Job"
5. Check monthly_used counter

**Expected Results:**
- [ ] monthly_used counter resets to 0
- [ ] monthly_allocation is set to plan's monthly credits
- [ ] allocation_reset_date is updated to next month
- [ ] Transaction history shows reset entry
- [ ] All users' monthly counters are reset

---

## ADMIN FEATURES

### Priority: MEDIUM

**Note**: These tests require admin@kimiyavoice.com account

#### Test 6.1: Access Admin Panel
**Steps:**
1. Login with admin@kimiyavoice.com
2. Click profile icon > "Admin Panel"
3. OR navigate to /admin/users

**Expected Results:**
- [ ] Admin panel loads
- [ ] Admin menu appears in navigation
- [ ] User management section is accessible
- [ ] Billing section is accessible
- [ ] Credit management section is accessible

---

#### Test 6.2: User Management - View Users
**Steps:**
1. In Admin Panel, click "Users" or "User Management"
2. View list of all users
3. See user statistics (total users, active users, admin count)

**Expected Results:**
- [ ] User list displays all users
- [ ] Each user shows:
  - [ ] Name
  - [ ] Email
  - [ ] Role (Admin/User)
  - [ ] Status (Active/Inactive)
  - [ ] Last login date
  - [ ] Workflow count
- [ ] User statistics are accurate

---

#### Test 6.3: User Management - Search & Filter
**Steps:**
1. In User Management, use search box
2. Search for "testuser"
3. Use role filter to show only "Admin" users
4. Use status filter to show only "Active" users

**Expected Results:**
- [ ] Search returns matching users
- [ ] Role filter works correctly
- [ ] Status filter works correctly
- [ ] Multiple filters can be combined

---

#### Test 6.4: User Details & Chat History
**Steps:**
1. In User Management, click on a user (e.g., testuser@kimiyavoice.com)
2. View user details page
3. Scroll to "Chat History" section

**Expected Results:**
- [ ] User details page loads
- [ ] Shows user information (name, email, role, status)
- [ ] Shows account creation date
- [ ] Shows last login date
- [ ] Chat history displays recent conversations
- [ ] Each chat entry shows:
  - [ ] Date/time
  - [ ] Workflow used
  - [ ] Message count
  - [ ] Duration

---

#### Test 6.5: User Status Management
**Steps:**
1. In User Management, find a test user
2. Click "Deactivate" button
3. Confirm deactivation
4. Verify user status changes to "Inactive"
5. Click "Activate" button
6. Verify user status changes to "Active"

**Expected Results:**
- [ ] User can be deactivated
- [ ] Deactivated user cannot login
- [ ] User can be reactivated
- [ ] Reactivated user can login again

---

#### Test 6.6: Admin Credit Allocation
**Steps:**
1. In Admin Panel, click "Credit Management"
2. Find a user (e.g., testuser@kimiyavoice.com)
3. Click "Allocate Credits"
4. Enter amount: 50000
5. Enter reason: "QA Testing Allocation"
6. Click "Allocate"

**Expected Results:**
- [ ] Credit allocation form appears
- [ ] Credits are allocated successfully
- [ ] User's credit balance increases
- [ ] Transaction history shows allocation
- [ ] Allocation reason is recorded

---

#### Test 6.7: Admin Billing Dashboard
**Steps:**
1. In Admin Panel, click "Billing" or "Billing Management"
2. View organization billing information
3. View current subscription plan
4. View billing history

**Expected Results:**
- [ ] Billing dashboard loads
- [ ] Shows current plan (e.g., "Professional Plan")
- [ ] Shows subscription status
- [ ] Shows next billing date
- [ ] Shows billing history with all invoices
- [ ] Each invoice shows:
  - [ ] Date
  - [ ] Amount
  - [ ] Plan
  - [ ] Status (Paid/Pending)

---

## BILLING & SUBSCRIPTION

### Priority: HIGH

**Note**: Use Stripe test mode cards for all payment tests

#### Test 7.1: Access Billing Page
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click "Credits" > "Upgrade Plan"
3. OR click profile icon > "Billing"

**Expected Results:**
- [ ] Billing/pricing page loads
- [ ] All plans are displayed:
  - [ ] Starter Plan: 30,000 credits/month
  - [ ] Professional Plan: 180,000 credits/month
  - [ ] Business Plan: 720,000 credits/month
  - [ ] Enterprise Plan: Custom pricing
- [ ] Monthly and Annual billing options are shown
- [ ] Annual discount is displayed (e.g., "Save 20%")
- [ ] "Select Plan" or "Subscribe" button is visible for each plan

---

#### Test 7.2: Monthly Plan Purchase - Starter
**Steps:**
1. On Billing page, select "Starter Plan"
2. Ensure "Monthly" billing is selected
3. Click "Subscribe" or "Select Plan"
4. Stripe checkout page opens
5. Enter test card: 4242 4242 4242 4242
6. Enter expiry: 12/25
7. Enter CVC: 123
8. Enter billing name and address
9. Click "Pay" or "Subscribe"

**Expected Results:**
- [ ] Stripe checkout loads
- [ ] Payment is processed successfully
- [ ] Redirected to success page
- [ ] Success message appears
- [ ] Credits are allocated (30,000 for Starter)
- [ ] Subscription appears in billing history
- [ ] Next billing date is set to 30 days from now

---

#### Test 7.3: Monthly Plan Purchase - Professional
**Steps:**
1. On Billing page, select "Professional Plan"
2. Ensure "Monthly" billing is selected
3. Complete payment with test card 4242 4242 4242 4242

**Expected Results:**
- [ ] Payment succeeds
- [ ] 180,000 credits allocated
- [ ] Billing history updated
- [ ] Plan shows as "Professional"

---

#### Test 7.4: Annual Plan Purchase
**Steps:**
1. On Billing page, select "Professional Plan"
2. Click "Annual" billing option
3. Verify annual discount is applied (e.g., price reduced by 20%)
4. Complete payment with test card 4242 4242 4242 4242

**Expected Results:**
- [ ] Annual price is lower than 12x monthly price
- [ ] Discount percentage is displayed
- [ ] Payment succeeds
- [ ] Subscription shows annual billing cycle
- [ ] Next billing date is 365 days from now

---

#### Test 7.5: Failed Payment Scenario
**Steps:**
1. On Billing page, select any plan
2. Click "Subscribe"
3. Enter test card: 4000 0000 0000 0002 (declined card)
4. Complete other fields
5. Click "Pay"

**Expected Results:**
- [ ] Payment is declined
- [ ] Error message appears
- [ ] User is not charged
- [ ] Subscription is not created
- [ ] User can try again with different card

---

#### Test 7.6: View Billing History
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Click "Credits" > "Billing History"
3. View all past invoices and payments

**Expected Results:**
- [ ] Billing history displays all transactions
- [ ] Each entry shows:
  - [ ] Date
  - [ ] Plan name
  - [ ] Amount paid
  - [ ] Status (Paid/Pending)
  - [ ] Invoice number
- [ ] Can download invoices (if applicable)
- [ ] Transactions are sorted by date (newest first)

---

#### Test 7.7: Plan Upgrade
**Steps:**
1. Currently on "Starter Plan"
2. Go to Billing page
3. Select "Professional Plan"
4. Click "Upgrade"
5. Complete payment

**Expected Results:**
- [ ] Upgrade option is available
- [ ] Payment is processed
- [ ] Credits are adjusted (prorated if applicable)
- [ ] Plan changes to "Professional"
- [ ] New credit allocation is applied

---

## CALL TESTING

### Priority: MEDIUM

#### Test 8.1: Inbound Call Testing Interface
**Steps:**
1. Click profile icon > "Inbound Testing"
2. OR navigate to /inbound-testing

**Expected Results:**
- [ ] Inbound testing page loads
- [ ] Workflow selector dropdown is visible
- [ ] Call controls are visible (Initialize, Make Call, Disconnect, Mute)
- [ ] Call status display is visible
- [ ] Call log/event display is visible

---

#### Test 8.2: Initialize Inbound Test Call
**Steps:**
1. On Inbound Testing page
2. Select a workflow from dropdown (e.g., "QA Test Workflow")
3. Enter custom caller identity (optional): "QA Tester"
4. Click "Initialize Call"

**Expected Results:**
- [ ] Call initialization succeeds
- [ ] Status changes to "Initialized"
- [ ] Call controls become active
- [ ] Event log shows initialization event

---

#### Test 8.3: Make Test Call
**Steps:**
1. After initializing call
2. Click "Make Call" button
3. Wait for connection

**Expected Results:**
- [ ] Call status changes to "Connecting"
- [ ] After a few seconds, status changes to "Connected"
- [ ] Audio connection is established (if audio is available)
- [ ] Call duration timer starts
- [ ] Event log shows connection events

---

#### Test 8.4: Send DTMF Tones
**Steps:**
1. During active call
2. Click DTMF button for "1"
3. Click DTMF button for "2"
4. Click DTMF button for "3"

**Expected Results:**
- [ ] DTMF tones are sent
- [ ] Event log shows DTMF events
- [ ] Workflow responds to DTMF input (if configured)

---

#### Test 8.5: Disconnect Call
**Steps:**
1. During active call
2. Click "Disconnect" button

**Expected Results:**
- [ ] Call status changes to "Disconnected"
- [ ] Call duration is recorded
- [ ] Event log shows disconnect event
- [ ] Call controls become inactive

---

#### Test 8.6: Call Logging
**Steps:**
1. Complete a full call cycle (Initialize > Make Call > Disconnect)
2. View event log

**Expected Results:**
- [ ] All call events are logged:
  - [ ] Initialization
  - [ ] Connection attempt
  - [ ] Connected
  - [ ] DTMF input (if sent)
  - [ ] Disconnection
- [ ] Each event shows timestamp
- [ ] Event descriptions are clear

---

## NAVIGATION & UI

### Priority: MEDIUM

#### Test 9.1: Main Navigation
**Steps:**
1. Login with testuser@kimiyavoice.com
2. Verify all navigation items are accessible:
   - [ ] Dashboard
   - [ ] Workflow Builder
   - [ ] Contacts
   - [ ] Credits
   - [ ] Profile (dropdown)

**Expected Results:**
- [ ] All navigation items are clickable
- [ ] Each navigation item takes you to correct page
- [ ] Current page is highlighted in navigation
- [ ] Navigation is consistent across all pages

---

#### Test 9.2: Profile Dropdown Menu
**Steps:**
1. Click profile icon (top right)
2. View dropdown menu

**Expected Results:**
- [ ] Dropdown shows:
  - [ ] Dashboard
  - [ ] Inbound Testing
  - [ ] Profile
  - [ ] Logout
  - [ ] (Admin Panel - if admin user)
- [ ] All menu items are clickable
- [ ] Menu closes when item is clicked

---

#### Test 9.3: Responsive Design
**Steps:**
1. Open application in desktop browser (1920x1080)
2. Verify layout is correct
3. Resize browser to tablet size (768x1024)
4. Verify layout adapts
5. Resize browser to mobile size (375x667)
6. Verify layout adapts

**Expected Results:**
- [ ] Desktop layout is clean and organized
- [ ] Tablet layout is readable and functional
- [ ] Mobile layout is usable (no horizontal scrolling)
- [ ] All buttons and inputs are accessible on all sizes
- [ ] Navigation adapts (hamburger menu on mobile if applicable)

---

#### Test 9.4: Toast Notifications
**Steps:**
1. Perform actions that trigger notifications:
   - [ ] Save a workflow
   - [ ] Create a contact
   - [ ] Allocate credits (admin)
2. Observe notification messages

**Expected Results:**
- [ ] Toast notifications appear for successful actions
- [ ] Notifications show appropriate message
- [ ] Notifications auto-dismiss after 3-5 seconds
- [ ] Error notifications appear for failed actions
- [ ] Error messages are clear and helpful

---

#### Test 9.5: Loading States
**Steps:**
1. Perform actions that take time:
   - [ ] Save a large workflow
   - [ ] Import contacts from CSV
   - [ ] Process payment
2. Observe loading indicators

**Expected Results:**
- [ ] Loading spinner or indicator appears
- [ ] UI is disabled during loading (prevents double-clicks)
- [ ] Loading indicator disappears when action completes
- [ ] Success/error message appears after loading

---

## TROUBLESHOOTING

### Common Issues & Solutions

#### Issue: Cannot Login
**Solution:**
- Verify email and password are correct
- Check if account is active (not deactivated)
- Clear browser cookies and try again
- Try in incognito/private browser window
- Check if rate limit has been reached (wait 15 minutes)

#### Issue: Workflow Won't Save
**Solution:**
- Verify all required fields are filled
- Check browser console for errors (F12 > Console)
- Try refreshing page and saving again
- Ensure you have sufficient credits
- Try in different browser

#### Issue: Chat Playground Not Responding
**Solution:**
- Verify workflow is activated
- Check if you have sufficient credits
- Refresh the page
- Try with a different workflow
- Check browser console for errors

#### Issue: Payment Fails
**Solution:**
- Verify test card number is correct (4242 4242 4242 4242)
- Check expiry date is in future
- Ensure CVC is 3 digits
- Try different test card (see Stripe test cards below)
- Check browser console for errors

#### Issue: Contacts Not Appearing After Import
**Solution:**
- Verify CSV format is correct
- Check column mapping is correct
- Ensure no duplicate emails exist
- Try importing smaller batch first
- Check browser console for errors

---

### Stripe Test Cards

**Successful Payment:**
- Card Number: 4242 4242 4242 4242
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

**Declined Card:**
- Card Number: 4000 0000 0000 0002
- Expiry: Any future date
- CVC: Any 3 digits

**Requires Authentication:**
- Card Number: 4000 0025 0000 3155
- Expiry: Any future date
- CVC: Any 3 digits

---

## TEST EXECUTION CHECKLIST

Use this checklist to track your testing progress:

### Authentication & User Management
- [ ] User Registration
- [ ] User Login
- [ ] User Logout
- [ ] Profile Management
- [ ] Password Change

### Workflow Builder
- [ ] Access Workflow Builder
- [ ] Create Simple Workflow
- [ ] Workflow Activation/Deactivation
- [ ] Workflow Import/Export

### Chat Playground
- [ ] Access Chat Playground
- [ ] Test Workflow with Chat
- [ ] Workflow Logic Verification
- [ ] Credit Deduction Verification

### Contact Management
- [ ] Create Contact
- [ ] Edit Contact
- [ ] Delete Contact
- [ ] Contact Groups
- [ ] Contact Tags
- [ ] Search & Filter
- [ ] CSV Import/Export

### Credit System
- [ ] View Credit Balance
- [ ] View Credit Transactions
- [ ] Real-time Credit Deduction
- [ ] Credit Allocation on Purchase

### Admin Features (Admin Account)
- [ ] Access Admin Panel
- [ ] View Users
- [ ] Search & Filter Users
- [ ] User Details & Chat History
- [ ] User Status Management
- [ ] Credit Allocation
- [ ] Billing Dashboard

### Billing & Subscription
- [ ] Access Billing Page
- [ ] Monthly Plan Purchase (Starter)
- [ ] Monthly Plan Purchase (Professional)
- [ ] Annual Plan Purchase
- [ ] Failed Payment Scenario
- [ ] View Billing History
- [ ] Plan Upgrade

### Call Testing
- [ ] Inbound Testing Interface
- [ ] Initialize Call
- [ ] Make Call
- [ ] Send DTMF Tones
- [ ] Disconnect Call
- [ ] Call Logging

### Navigation & UI
- [ ] Main Navigation
- [ ] Profile Dropdown Menu
- [ ] Responsive Design
- [ ] Toast Notifications
- [ ] Loading States

---

---

## ADVANCED TESTING SCENARIOS

### Test 10.1: Multi-User Real-time Synchronization
**Objective**: Verify that workflow changes sync across multiple users in real-time

**Steps:**
1. Open two browser windows/tabs
2. In Window 1: Login as testuser@kimiyavoice.com
3. In Window 2: Login as different user (or same user in incognito)
4. In Window 1: Open "QA Test Workflow" in builder
5. In Window 1: Add a new node to the workflow
6. In Window 1: Save the workflow
7. In Window 2: Open the same workflow
8. Refresh Window 2 if needed

**Expected Results:**
- [ ] New node appears in Window 2 without manual refresh
- [ ] All users see the same workflow state
- [ ] Changes propagate within 1-2 seconds
- [ ] No conflicts or data loss occurs

---

### Test 10.2: Concurrent Credit Deduction
**Objective**: Verify credits are deducted correctly during simultaneous chat sessions

**Steps:**
1. Note current credit balance
2. Open Chat Playground in two tabs
3. In Tab 1: Start conversation with 5 messages
4. In Tab 2: Simultaneously start conversation with 5 messages
5. Complete both conversations
6. Check credit balance

**Expected Results:**
- [ ] Both conversations complete successfully
- [ ] Credits are deducted for both conversations
- [ ] Total deduction equals sum of both conversations
- [ ] No double-charging or missed deductions
- [ ] Balance never goes negative

---

### Test 10.3: Workflow with Complex Branching
**Objective**: Verify complex conditional logic works correctly

**Steps:**
1. Create workflow with multiple branches:
   - Start node
   - Conversation: "What is your account type? (personal/business)"
   - Branch 1 (personal): "What is your budget? (low/medium/high)"
   - Branch 2 (business): "How many employees? (1-10/11-50/50+)"
   - Different end messages for each path
2. Test all 5 possible paths through the workflow
3. Verify correct response for each path

**Expected Results:**
- [ ] All branches execute correctly
- [ ] Conditional logic works as designed
- [ ] No branches are skipped or merged incorrectly
- [ ] Responses are appropriate for each path

---

### Test 10.4: Large Contact Import
**Objective**: Verify system handles bulk contact import correctly

**Steps:**
1. Create CSV file with 500+ contacts
2. Go to Contacts > Import
3. Upload CSV file
4. Map columns correctly
5. Click "Import"
6. Wait for import to complete

**Expected Results:**
- [ ] Import completes without errors
- [ ] All 500+ contacts appear in list
- [ ] No contacts are duplicated
- [ ] Search and filter work with imported contacts
- [ ] Performance remains acceptable

---

### Test 10.5: Credit Expiration & Renewal
**Objective**: Verify billing cycle reset and credit renewal

**Steps:**
1. Note current credit balance and expiration date
2. Wait for billing cycle to end (or simulate in admin)
3. Observe credit balance after renewal

**Expected Results:**
- [ ] Credits are renewed on schedule
- [ ] New allocation appears in transaction history
- [ ] Expiration date is updated
- [ ] Days remaining counter resets
- [ ] Old credits are not carried over (if policy is to reset)

---

## PERFORMANCE & STRESS TESTING

### Test 11.1: Workflow Builder Performance
**Objective**: Verify builder remains responsive with complex workflows

**Steps:**
1. Create workflow with 20+ nodes
2. Add 15+ connections between nodes
3. Test drag-and-drop responsiveness
4. Test configuration panel responsiveness
5. Test save performance

**Expected Results:**
- [ ] Builder remains responsive
- [ ] No lag when dragging nodes
- [ ] Configuration panel updates quickly
- [ ] Save completes within 2-3 seconds
- [ ] No crashes or freezes

---

### Test 11.2: Chat Playground with Long Conversation
**Objective**: Verify chat remains responsive during long conversations

**Steps:**
1. Open Chat Playground
2. Have 50+ message conversation
3. Scroll through chat history
4. Verify message loading

**Expected Results:**
- [ ] Chat remains responsive
- [ ] No lag when sending messages
- [ ] Scrolling is smooth
- [ ] All messages load correctly
- [ ] No memory leaks or crashes

---

### Test 11.3: Contact List Performance
**Objective**: Verify contacts list remains responsive with many contacts

**Steps:**
1. Ensure 1000+ contacts in system
2. Open Contacts page
3. Test pagination
4. Test search with 1000+ contacts
5. Test filtering with 1000+ contacts

**Expected Results:**
- [ ] Page loads within 2-3 seconds
- [ ] Pagination works smoothly
- [ ] Search completes within 1 second
- [ ] Filtering is responsive
- [ ] No crashes or freezes

---

## SECURITY TESTING

### Test 12.1: Protected Routes
**Objective**: Verify unauthenticated users cannot access protected pages

**Steps:**
1. Logout or clear cookies
2. Try to access /dashboard directly
3. Try to access /builder directly
4. Try to access /admin/users directly

**Expected Results:**
- [ ] All protected routes redirect to login
- [ ] Cannot access dashboard without login
- [ ] Cannot access builder without login
- [ ] Cannot access admin panel without login

---

### Test 12.2: Role-Based Access Control - Admin Routes Blocked
**Objective**: Verify regular users cannot access admin features

**Steps:**
1. Login as testuser@kimiyavoice.com (regular user)
2. Try to access /admin/users directly (type in URL bar)
3. Try to access /admin/credits directly
4. Try to access /admin/billing directly
5. Check if admin menu items appear in profile dropdown

**Expected Results:**
- [ ] /admin/users shows "Access Denied" page
- [ ] /admin/credits shows "Access Denied" page
- [ ] /admin/billing shows "Access Denied" page
- [ ] Error message states: "You don't have permission to access this page. This page requires admin role."
- [ ] Current role shown as "user"
- [ ] Admin menu items do NOT appear in profile dropdown
- [ ] No admin functionality is visible anywhere

---

### Test 12.3: Admin-Only API Endpoints Blocked
**Objective**: Verify regular users cannot call admin-only API endpoints

**Steps:**
1. Login as testuser@kimiyavoice.com (regular user)
2. Open browser DevTools (F12)
3. Go to Console tab
4. Try to call admin endpoint:
   ```javascript
   fetch('/api/auth/admin/users', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
   }).then(r => r.json()).then(d => console.log(d))
   ```
5. Observe response

**Expected Results:**
- [ ] API returns 403 Forbidden status
- [ ] Response contains: `"error": "Insufficient permissions"`
- [ ] Response contains: `"message": "This action requires one of the following roles: admin"`
- [ ] No user data is returned
- [ ] No sensitive information is leaked

---

### Test 12.4: Admin Can Access All User Data
**Objective**: Verify admins can access all users' data

**Steps:**
1. Login as admin@kimiyavoice.com (admin user)
2. Go to Admin Panel > Users
3. View list of all users
4. Click on testuser@kimiyavoice.com
5. View user details and chat history
6. Go to Admin Panel > Credit Management
7. View all users' credit balances

**Expected Results:**
- [ ] Admin can see all users in the system
- [ ] Admin can view any user's details
- [ ] Admin can view any user's chat history
- [ ] Admin can see all users' credit balances
- [ ] Admin can see all users' transaction history
- [ ] No access denied errors appear

---

### Test 12.5: Regular User Cannot See Other Users' Data
**Objective**: Verify regular users cannot access other users' data

**Steps:**
1. Login as testuser@kimiyavoice.com (regular user)
2. Try to access /api/credits/balance/2 (different user ID)
3. Try to access /api/credits/transactions/2 (different user ID)
4. Observe responses

**Expected Results:**
- [ ] API returns 403 Forbidden status
- [ ] Response contains: `"error": "Access denied"`
- [ ] Response contains: `"message": "You can only view your own credit balance"`
- [ ] No other user's data is returned
- [ ] Regular user can only access their own data (ID 1)

---

### Test 12.6: Admin Can View Organization Billing
**Objective**: Verify admins can access organization billing information

**Steps:**
1. Login as admin@kimiyavoice.com (admin user)
2. Go to Admin Panel > Billing
3. View organization subscription details
4. View billing history
5. View payment methods
6. View available credit plans

**Expected Results:**
- [ ] Admin can see organization subscription status
- [ ] Admin can see current plan (e.g., "Professional Plan")
- [ ] Admin can see next billing date
- [ ] Admin can see complete billing history
- [ ] Admin can see all payment methods
- [ ] Admin can see all available credit plans
- [ ] Admin can change organization plan

---

### Test 12.7: Regular User Cannot Access Billing Management
**Objective**: Verify regular users cannot manage organization billing

**Steps:**
1. Login as testuser@kimiyavoice.com (regular user)
2. Try to access /admin/billing directly
3. Try to call /api/admin/billing/* endpoints
4. Check if billing management options appear

**Expected Results:**
- [ ] /admin/billing shows "Access Denied" page
- [ ] API endpoints return 403 Forbidden
- [ ] No billing management options appear in UI
- [ ] Regular user can only see their own credit balance
- [ ] Regular user cannot change organization plan

---

### Test 12.3: Password Security
**Objective**: Verify passwords are properly hashed and validated

**Steps:**
1. Create new account with password: "TestPassword123!"
2. Try to login with: "testpassword123!" (lowercase)
3. Try to login with: "TestPassword123" (missing !)
4. Try to login with: "TestPassword123!"

**Expected Results:**
- [ ] Login fails with incorrect case
- [ ] Login fails with missing special character
- [ ] Login succeeds with exact password
- [ ] Password is not displayed in logs or UI

---

### Test 12.4: Rate Limiting
**Objective**: Verify rate limiting prevents brute force attacks

**Steps:**
1. Attempt login 11 times with wrong password within 15 minutes
2. Observe response on 11th attempt
3. Wait 15 minutes
4. Try login again

**Expected Results:**
- [ ] First 10 attempts show "Invalid password" error
- [ ] 11th attempt shows rate limit message
- [ ] Cannot login until rate limit expires
- [ ] After 15 minutes, can attempt login again

---

## DATA INTEGRITY TESTING

### Test 13.1: Workflow Data Persistence
**Objective**: Verify workflow data is correctly saved to database

**Steps:**
1. Create workflow with specific configuration
2. Close browser completely
3. Reopen browser and login
4. Navigate to workflow

**Expected Results:**
- [ ] Workflow data is intact
- [ ] All nodes are present
- [ ] All connections are present
- [ ] Configuration is preserved
- [ ] No data loss

---

### Test 13.2: Contact Data Integrity
**Objective**: Verify contact data is correctly saved and retrieved

**Steps:**
1. Create contact with all fields filled
2. Edit contact multiple times
3. Delete and restore (if applicable)
4. Export and verify data

**Expected Results:**
- [ ] All contact fields are saved correctly
- [ ] Edits are persisted
- [ ] No data corruption
- [ ] Export shows correct data

---

### Test 13.3: Credit Transaction Accuracy
**Objective**: Verify credit transactions are accurately recorded

**Steps:**
1. Note starting balance
2. Have chat conversation (note deduction)
3. Purchase credits (note allocation)
4. Verify transaction history

**Expected Results:**
- [ ] All transactions are recorded
- [ ] Amounts are accurate
- [ ] Running balance is correct
- [ ] No transactions are missing
- [ ] No duplicate transactions

---

## EDGE CASE TESTING

### Test 14.1: Empty Workflow Execution
**Objective**: Verify system handles empty/minimal workflows

**Steps:**
1. Create workflow with only Start and End Call nodes
2. Test in Chat Playground
3. Observe behavior

**Expected Results:**
- [ ] Workflow executes without errors
- [ ] Appropriate message or behavior occurs
- [ ] No crashes or undefined behavior

---

### Test 14.2: Very Long Contact Names
**Objective**: Verify system handles edge case data

**Steps:**
1. Create contact with 200+ character name
2. Create contact with special characters: !@#$%^&*()
3. Create contact with unicode characters: 你好世界
4. Verify display and search

**Expected Results:**
- [ ] All names are stored correctly
- [ ] Display is not broken
- [ ] Search works with special characters
- [ ] No database errors

---

### Test 14.3: Rapid Workflow Saves
**Objective**: Verify system handles rapid consecutive saves

**Steps:**
1. Open workflow in builder
2. Make small change
3. Click Save
4. Immediately make another change
5. Click Save again
6. Repeat 5+ times rapidly

**Expected Results:**
- [ ] All saves complete successfully
- [ ] No data loss
- [ ] No conflicts
- [ ] No error messages

---

### Test 14.4: Zero Credit Balance
**Objective**: Verify system behavior when credits reach zero

**Steps:**
1. Use up all credits through chat
2. Try to start new chat session
3. Observe behavior

**Expected Results:**
- [ ] Chat is blocked or limited
- [ ] Clear message about insufficient credits
- [ ] User is prompted to purchase more credits
- [ ] No unexpected behavior

---

## BROWSER COMPATIBILITY TESTING

### Test 15.1: Chrome Browser
**Steps:**
1. Open application in Chrome (latest version)
2. Test all major features
3. Check console for errors

**Expected Results:**
- [ ] All features work correctly
- [ ] No console errors
- [ ] Performance is good

---

### Test 15.2: Firefox Browser
**Steps:**
1. Open application in Firefox (latest version)
2. Test all major features
3. Check console for errors

**Expected Results:**
- [ ] All features work correctly
- [ ] No console errors
- [ ] Performance is good

---

### Test 15.3: Safari Browser
**Steps:**
1. Open application in Safari (latest version)
2. Test all major features
3. Check console for errors

**Expected Results:**
- [ ] All features work correctly
- [ ] No console errors
- [ ] Performance is good

---

### Test 15.4: Edge Browser
**Steps:**
1. Open application in Edge (latest version)
2. Test all major features
3. Check console for errors

**Expected Results:**
- [ ] All features work correctly
- [ ] No console errors
- [ ] Performance is good

---

## COMPREHENSIVE ROLE & CREDIT SYSTEM TESTING

### Test Suite 1: Role Hierarchy Verification (7 Tests)

#### Test R1: Regular User Cannot Access User Management
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Try to navigate to /admin/users
3. Try to access /api/auth/admin/users via API
4. Check profile dropdown for admin options

**Expected Results:**
- [ ] /admin/users shows "Access Denied" page
- [ ] API returns 403 Forbidden
- [ ] No admin menu items in profile dropdown
- [ ] Error message mentions admin role requirement

---

#### Test R2: Regular User Cannot Access Credit Management
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Try to navigate to /admin/credits
3. Try to call /api/admin/credits/overview
4. Try to call /api/admin/credits/allocate

**Expected Results:**
- [ ] /admin/credits shows "Access Denied" page
- [ ] All API calls return 403 Forbidden
- [ ] Error message: "Insufficient permissions"
- [ ] No credit management UI appears

---

#### Test R3: Regular User Cannot Access Billing Management
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Try to navigate to /admin/billing
3. Try to call /api/admin/billing/* endpoints

**Expected Results:**
- [ ] /admin/billing shows "Access Denied" page
- [ ] All API calls return 403 Forbidden
- [ ] No billing management options appear

---

#### Test R4: Admin Can Access All Admin Features
**Priority**: HIGH
**Steps:**
1. Login as admin@kimiyavoice.com
2. Navigate to /admin/users
3. Navigate to /admin/credits
4. Navigate to /admin/billing
5. Verify all pages load successfully

**Expected Results:**
- [ ] All admin pages load without errors
- [ ] User management page shows all users
- [ ] Credit management page shows all balances
- [ ] Billing page shows organization subscription
- [ ] No access denied errors

---

#### Test R5: Admin Can View All Users' Data
**Priority**: HIGH
**Steps:**
1. Login as admin@kimiyavoice.com
2. Go to /admin/users
3. Click on testuser@kimiyavoice.com
4. View user details and chat history
5. Go to /admin/credits
6. View testuser's credit balance

**Expected Results:**
- [ ] Admin can see all users in list
- [ ] Admin can view any user's details
- [ ] Admin can view any user's chat history
- [ ] Admin can see any user's credit balance
- [ ] No access denied errors

---

#### Test R6: Regular User Cannot See Other Users' Credit Balance
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Try to call /api/credits/balance/2 (different user)
3. Try to call /api/credits/transactions/2

**Expected Results:**
- [ ] API returns 403 Forbidden
- [ ] Error message: "You can only view your own credit balance"
- [ ] No other user's data is returned
- [ ] Regular user can only access their own ID

---

#### Test R7: Admin Can Allocate Credits to Users
**Priority**: HIGH
**Steps:**
1. Login as admin@kimiyavoice.com
2. Go to /admin/credits
3. Find testuser@kimiyavoice.com
4. Click "Allocate Credits"
5. Enter 50000 credits
6. Enter reason: "QA Testing"
7. Click "Allocate"

**Expected Results:**
- [ ] Allocation succeeds
- [ ] Success message appears
- [ ] User's balance increases by 50,000
- [ ] Transaction history shows allocation
- [ ] Allocation type recorded correctly

---

### Test Suite 2: Credit System Architecture (10 Tests)

#### Test C1: Per-User Credit Balance Visibility
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Go to Credits dashboard
3. Note balance: X
4. Logout
5. Login as admin@kimiyavoice.com
6. Go to Admin Panel > Credit Management
7. Find testuser and note balance: Y

**Expected Results:**
- [ ] Both show same balance (X = Y)
- [ ] Regular user sees only their balance
- [ ] Admin can see all users' balances
- [ ] Balances are accurate and consistent

---

#### Test C2: Credit Allocation to All Organization Users
**Priority**: HIGH
**Prerequisites**: Organization with 2+ users
**Steps:**
1. Note current balance for User 1: B1
2. Note current balance for User 2: B2
3. Login as admin
4. Purchase Professional Plan (180,000 credits)
5. Complete payment
6. Check User 1 balance: B1_new
7. Check User 2 balance: B2_new

**Expected Results:**
- [ ] B1_new = B1 + 180,000
- [ ] B2_new = B2 + 180,000
- [ ] Both users receive FULL allocation (not split)
- [ ] Both users' transaction history shows allocation
- [ ] Both users' billing cycle reset date updated

---

#### Test C3: Admin Manual Credit Allocation
**Priority**: HIGH
**Steps:**
1. Login as admin@kimiyavoice.com
2. Note testuser's balance: X
3. Go to Admin Panel > Credit Management
4. Allocate 50,000 credits to testuser
5. Enter reason: "Bonus Credits"
6. Check testuser's new balance: Y

**Expected Results:**
- [ ] Y = X + 50,000
- [ ] Transaction recorded immediately
- [ ] Transaction type: "allocation" or "bonus"
- [ ] Reason recorded: "Bonus Credits"
- [ ] Admin ID recorded as "allocated_by"

---

#### Test C4: Real-Time Credit Deduction During Chat
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Note balance: X
3. Open Chat Playground
4. Send 5 messages
5. Return to Credit Dashboard
6. Note balance: Y

**Expected Results:**
- [ ] Y = X - 5 (1 credit per message)
- [ ] Deduction happens in real-time
- [ ] Transaction history shows 5 deduction entries
- [ ] Each entry shows service_type: "chat"
- [ ] Balance never goes negative

---

#### Test C5: Per-User Credit Deduction (Multi-User)
**Priority**: HIGH
**Prerequisites**: Organization with 2+ users
**Steps:**
1. User 1 balance: 100,000
2. User 2 balance: 100,000
3. User 1 sends 10 chat messages
4. Check User 1 balance: should be 99,990
5. Check User 2 balance: should be 100,000

**Expected Results:**
- [ ] User 1 balance decreased by 10
- [ ] User 2 balance unchanged
- [ ] Only User 1's transaction history shows deductions
- [ ] User 2's transaction history unchanged

---

#### Test C6: Admin Can View All Credit Transactions
**Priority**: MEDIUM
**Steps:**
1. Login as admin@kimiyavoice.com
2. Go to Admin Panel > Credit Management
3. View credit overview
4. View recent allocations
5. View usage by service type

**Expected Results:**
- [ ] Admin can see all users' transactions
- [ ] Admin can see total credits allocated
- [ ] Admin can see total credits used
- [ ] Admin can see total credits remaining
- [ ] Admin can see usage breakdown by service

---

#### Test C7: Regular User Cannot See Organization-Wide Credits
**Priority**: MEDIUM
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Try to access /api/admin/credits/overview
3. Try to access /api/admin/credits/statistics
4. Check if admin credit overview appears in UI

**Expected Results:**
- [ ] API calls return 403 Forbidden
- [ ] No admin credit overview appears in UI
- [ ] Regular user can only see own balance
- [ ] No organization-wide statistics visible

---

#### Test C8: Credit Expiration After 365 Days
**Priority**: MEDIUM
**Steps:**
1. Login as admin@kimiyavoice.com
2. Allocate 100,000 credits to testuser with expiration 365+ days ago
3. Go to Admin Panel > Credit Management
4. Click "Cleanup Expired Credits"
5. Check testuser's balance

**Expected Results:**
- [ ] Expired credits are removed
- [ ] Transaction history shows expiration
- [ ] Balance reflects removal
- [ ] User is notified (if applicable)

---

#### Test C9: Monthly Billing Cycle Reset
**Priority**: MEDIUM
**Steps:**
1. Login as admin@kimiyavoice.com
2. Note monthly_used and monthly_allocation
3. Go to Admin Panel > Credit Management
4. Click "Run Monthly Reset Job"
5. Check monthly_used counter

**Expected Results:**
- [ ] monthly_used resets to 0
- [ ] monthly_allocation set to plan credits
- [ ] allocation_reset_date updated
- [ ] All users' counters reset
- [ ] Transaction history shows reset

---

#### Test C10: Credit Balance Cannot Go Negative
**Priority**: HIGH
**Steps:**
1. Login as testuser@kimiyavoice.com
2. Note balance: X (e.g., 100)
3. Try to send 200 chat messages
4. Observe behavior after balance reaches 0

**Expected Results:**
- [ ] Chat is blocked when balance reaches 0
- [ ] Error message: "Insufficient credits"
- [ ] User is prompted to purchase more credits
- [ ] Balance never goes negative
- [ ] No transactions recorded after balance = 0

---

## REGRESSION TESTING CHECKLIST

After any code changes, verify these critical features still work:

- [ ] User can login and logout
- [ ] Workflows can be created and saved
- [ ] Chat playground works
- [ ] Credits are deducted correctly
- [ ] Contacts can be managed
- [ ] Admin features work (if admin)
- [ ] Billing page loads
- [ ] Navigation works
- [ ] No console errors
- [ ] No broken links

---

## KNOWN LIMITATIONS & NOTES

1. **Analytics Dashboard**: Some advanced analytics features may not be fully functional in development environment
2. **Call Recording**: Call recording functionality may require additional Twilio configuration
3. **Sentiment Analysis**: Sentiment analysis in chat analytics may be in beta
4. **Enterprise Plan**: Enterprise plan pricing requires manual configuration
5. **Webhook Events**: Some webhook events may not be fully implemented in development

---

## REPORTING BUGS

When reporting bugs, include:

1. **Environment**: Browser, OS, URL
2. **Steps to Reproduce**: Exact steps to reproduce the issue
3. **Expected Result**: What should happen
4. **Actual Result**: What actually happened
5. **Screenshots**: Visual evidence of the issue
6. **Console Errors**: Any JavaScript errors (F12 > Console)
7. **Network Errors**: Any failed API calls (F12 > Network)
8. **Severity**: Critical/High/Medium/Low
9. **Reproducibility**: Always/Sometimes/Rarely

---

**End of QA Testing Guide**

**Document prepared for**: External QA Testing Team
**For questions or clarifications**: Contact development team
**Last Updated**: October 26, 2025

