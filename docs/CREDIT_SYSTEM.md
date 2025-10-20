# Credit-Based Pricing and Usage Tracking System

## Overview

This document describes the comprehensive credit-based pricing and usage tracking system implemented for the Kimiya Voice AI SaaS platform. The system provides a unified credit model where all usage parameters are consolidated into a single credit system for end users.

## Phase 1 Implementation (UI Components)

### Components Implemented

#### 1. Admin Dashboard - Credit Management UI
- **Location**: `/src/pages/AdminCreditManagement.tsx`
- **Route**: `/admin/credits`
- **Features**:
  - Credit allocation interface for distributing credits to users
  - Real-time credit usage tracking across all users
  - User credit balance overview with current balance and usage history
  - Credit adjustment controls for manual credit management
  - Usage breakdown by service type (chat, calls, storage, AI services)
  - Top users by usage analytics
  - Low balance and high usage alerts

#### 2. Usage Tracking Display UI
- **Location**: `/src/components/credit/UsageTrackingDisplay.tsx`
- **Features**:
  - Unified credit consumption view with breakdown by:
    - Chat usage (messages sent/received)
    - Inbound call usage (duration, minutes consumed)
    - Outbound call usage (duration, minutes consumed)
    - Conversation history storage
    - Transcription services
    - AI services (summaries, analysis)
  - Historical usage charts and period selection
  - Export functionality (UI ready, backend pending)
  - Responsive design for mobile and desktop

#### 3. User-Facing Credit Display
- **Location**: `/src/components/credit/CreditBalanceWidget.tsx`
- **Features**:
  - Credit balance widget with three variants (minimal, compact, detailed)
  - Consolidated view showing total available credits
  - Usage projections and remaining days calculation
  - Low credit warnings and alerts
  - Integration with existing pages (Dashboard, Profile)

#### 4. Credit Dashboard
- **Location**: `/src/pages/CreditDashboard.tsx`
- **Route**: `/credits`
- **Features**:
  - Comprehensive user credit dashboard
  - Tabbed interface for usage tracking and transaction history
  - Credit balance overview with alerts
  - Transaction history with filtering
  - Export functionality

### Type Definitions

#### Credit Types
- **Location**: `/src/types/creditTypes.ts`
- **Includes**:
  - `CreditBalance` - User credit balance information
  - `CreditTransaction` - Individual credit transactions
  - `UsageMetrics` - Detailed usage breakdown by service
  - `CreditAllocation` - Admin credit allocations
  - `CreditPlan` - Subscription plan definitions
  - `UserCreditSummary` - Comprehensive user credit overview
  - `AdminCreditOverview` - System-wide credit analytics

### Service Layer

#### Credit Service
- **Location**: `/src/services/creditService.ts`
- **Features**:
  - Mock data implementation for UI development
  - API structure ready for backend integration
  - Credit allocation, tracking, and usage calculations
  - Support for multiple credit plans (Basic, Professional, Enterprise, Ultimate)
  - Configurable credit rates for different services

### Credit Plans

Based on the provided pricing model image, the system supports four tiers:

1. **Basic** - $29/month
   - 60 minutes (3,600 credits)
   - 1 AI Operator, 5 concurrent calls
   - 1,000 AI messages
   - $0.15/extra minute

2. **Professional** - $399/month (Popular)
   - 2,500 minutes (150,000 credits)
   - 5 AI Operators, 20 concurrent calls
   - 20,000 AI messages
   - $0.12/extra minute

3. **Enterprise** - $1,999/month
   - 6,000 minutes (360,000 credits)
   - 10 AI Operators, 50 concurrent calls
   - 50,000 AI messages
   - $0.09/extra minute

4. **Ultimate** - Contact for pricing
   - Custom minutes (unlimited)
   - Unlimited features
   - Custom pricing

### Credit Rates Configuration

```typescript
const CREDIT_RATES = {
  chat_message: 1,           // 1 credit per message
  call_per_minute: 60,       // 60 credits per minute (1 per second)
  storage_per_mb_per_month: 10,  // 10 credits per MB per month
  transcription_per_minute: 30,  // 30 credits per minute
  ai_summary: 50,            // 50 credits per summary
  ai_analysis: 100           // 100 credits per analysis
};
```

### Navigation Integration

- Added credit management links to `DashboardHeader.tsx`
- User access: "Credits" menu item → `/credits`
- Admin access: "Credit Management" menu item → `/admin/credits`
- Routes added to `App.tsx` with proper role-based protection

### Mobile Responsiveness

All components are designed with mobile-first approach:
- Responsive grid layouts
- Touch-friendly buttons and interactions
- Collapsible sections for mobile screens
- Optimized typography and spacing

## Future Phases (Not Implemented)

### Phase 2: Backend API Integration
- Replace mock data with real API calls
- Implement credit deduction logic
- Database schema for credit tracking
- Real-time credit updates via WebSocket

### Phase 3: Billing Integration
- Payment processing integration
- Automatic credit top-ups
- Invoice generation
- Subscription management

### Phase 4: Advanced Analytics
- Predictive usage analytics
- Cost optimization recommendations
- Usage trend analysis
- Custom reporting

## Usage Examples

### Basic Credit Widget Integration
```tsx
import { CreditBalanceWidget } from '@/components/credit';

<CreditBalanceWidget
  userId={user.id}
  variant="compact"
  showAlerts={true}
  onViewDetails={() => navigate('/credits')}
/>
```

### Usage Tracking Display
```tsx
import { UsageTrackingDisplay } from '@/components/credit';

<UsageTrackingDisplay
  userId={user.id}
  showExportButton={true}
/>
```

### Admin Credit Management
```tsx
// Navigate to /admin/credits for full admin interface
// Includes credit allocation, user overview, and system analytics
```

## Testing Recommendations

1. **Component Testing**
   - Test all three widget variants (minimal, compact, detailed)
   - Verify responsive behavior on different screen sizes
   - Test loading states and error handling

2. **Integration Testing**
   - Test navigation between credit pages
   - Verify role-based access control
   - Test data flow between components

3. **User Experience Testing**
   - Test credit allocation workflow
   - Verify alert notifications
   - Test export functionality (UI)

## Deployment Notes

- All components use existing UI library (Radix UI)
- No additional dependencies required
- Compatible with existing authentication system
- Ready for backend API integration

## Support and Maintenance

- Components follow existing code patterns
- TypeScript interfaces ensure type safety
- Comprehensive error handling implemented
- Logging and monitoring ready for production
