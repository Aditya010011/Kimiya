// Credit Management Types for Kimiya Voice AI SaaS Platform

export interface CreditBalance {
  user_id: number;
  total_credits: number;
  available_credits: number;
  reserved_credits: number; // Credits reserved for ongoing operations
  last_updated: string;
  expires_at?: string; // Optional expiration date for credits
}

export interface CreditTransaction {
  id: number;
  user_id: number;
  transaction_type: 'allocation' | 'deduction' | 'refund' | 'adjustment' | 'expiration';
  amount: number; // Positive for additions, negative for deductions
  balance_before: number;
  balance_after: number;
  service_type: 'chat' | 'inbound_call' | 'outbound_call' | 'storage' | 'transcription' | 'ai_summary' | 'ai_analysis' | 'manual' | 'system';
  description: string;
  metadata?: {
    call_id?: string;
    chat_session_id?: string;
    workflow_id?: number;
    duration_seconds?: number;
    message_count?: number;
    admin_user_id?: number; // For manual adjustments
    [key: string]: any;
  };
  created_at: string;
  created_by?: number; // Admin user who made the transaction
}

export interface UsageMetrics {
  user_id: number;
  period_start: string;
  period_end: string;
  total_credits_used: number;
  breakdown: {
    chat_usage: {
      total_credits: number;
      message_count: number;
      session_count: number;
      average_credits_per_message: number;
    };
    inbound_calls: {
      total_credits: number;
      call_count: number;
      total_duration_seconds: number;
      average_credits_per_minute: number;
    };
    outbound_calls: {
      total_credits: number;
      call_count: number;
      total_duration_seconds: number;
      average_credits_per_minute: number;
    };
    storage: {
      total_credits: number;
      conversation_count: number;
      data_size_mb: number;
    };
    transcription: {
      total_credits: number;
      transcription_count: number;
      total_duration_seconds: number;
    };
    ai_services: {
      summary_credits: number;
      analysis_credits: number;
      summary_count: number;
      analysis_count: number;
    };
  };
}

export interface CreditAllocation {
  id: number;
  user_id: number;
  allocated_by: number; // Admin user ID
  amount: number;
  allocation_type: 'initial' | 'top_up' | 'bonus' | 'refund' | 'plan_upgrade';
  reason: string;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

export interface CreditPlan {
  id: string;
  name: string;
  description: string;
  monthly_credits: number; // Credits included per month (-1 for unlimited)
  price_usd: number; // Monthly price in USD (-1 for custom pricing)
  annual_price_usd?: number; // Annual price with discount (-1 for custom pricing)
  billing_cycle?: 'monthly' | 'annual' | 'custom'; // Billing cycle type
  features: {
    ai_operators: number; // Number of AI operators (-1 for unlimited)
    concurrent_calls: number; // Max concurrent calls (-1 for unlimited)
    campaigns_per_month: number; // Campaigns allowed per month (-1 for unlimited)
    ai_messages: number; // Chat messages included (-1 for unlimited)
    team_members: number; // Team members allowed (-1 for unlimited)
    extra_minute_cost: number; // Cost per minute overage
    extra_credit_cost?: number; // Cost per credit overage
  };
  is_popular?: boolean; // Mark as "Most Popular"
  is_enterprise?: boolean; // Mark as enterprise/custom plan
  minutes_included?: number; // Minutes included in plan (-1 for unlimited)
  cost_per_minute?: number; // Effective cost per minute (price / minutes)
}

export interface UserCreditSummary {
  user_id: number;
  user_email: string;
  user_name: string;
  current_balance: CreditBalance;
  current_plan?: CreditPlan;
  usage_this_month: UsageMetrics;
  recent_transactions: CreditTransaction[];
  projected_usage: {
    estimated_monthly_usage: number;
    days_remaining_at_current_rate: number;
    recommended_top_up?: number;
  };
  alerts: {
    low_balance: boolean;
    high_usage: boolean;
    expiring_credits: boolean;
  };
}

export interface AdminCreditOverview {
  total_users: number;
  total_credits_allocated: number;
  total_credits_used: number;
  total_credits_remaining: number;
  users_with_low_balance: number;
  users_with_high_usage: number;
  top_users_by_usage: Array<{
    user_id: number;
    user_email: string;
    user_name: string;
    credits_used: number;
    percentage_of_total: number;
  }>;
  usage_by_service: {
    chat: number;
    inbound_calls: number;
    outbound_calls: number;
    storage: number;
    transcription: number;
    ai_services: number;
  };
  recent_allocations: CreditAllocation[];
}

export interface CreditUsageChart {
  period: string; // Date string
  total_usage: number;
  chat_usage: number;
  call_usage: number;
  storage_usage: number;
  ai_services_usage: number;
}

export interface CreditAlert {
  id: number;
  user_id: number;
  alert_type: 'low_balance' | 'high_usage' | 'expiring_credits' | 'zero_balance';
  threshold_value: number;
  current_value: number;
  message: string;
  is_active: boolean;
  created_at: string;
  acknowledged_at?: string;
}

// API Response Types
export interface CreditApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreditFilters {
  user_id?: number;
  service_type?: string[];
  transaction_type?: string[];
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  limit?: number;
  offset?: number;
}

// Export Options for Reports
export interface CreditExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  include_transactions: boolean;
  include_usage_breakdown: boolean;
  date_range: {
    start: string;
    end: string;
  };
  user_ids?: number[];
}

// Real-time Credit Updates
export interface CreditRealtimeUpdate {
  user_id: number;
  event_type: 'balance_updated' | 'transaction_created' | 'alert_triggered';
  data: {
    new_balance?: number;
    transaction?: CreditTransaction;
    alert?: CreditAlert;
  };
  timestamp: string;
}

// Credit Configuration
export interface CreditRates {
  chat_message: number; // Credits per message
  call_per_minute: number; // Credits per minute
  storage_per_mb_per_month: number; // Credits per MB per month
  transcription_per_minute: number; // Credits per minute of transcription
  ai_summary: number; // Credits per summary
  ai_analysis: number; // Credits per analysis
}

export interface CreditSystemConfig {
  rates: CreditRates;
  default_allocation: number;
  low_balance_threshold: number;
  high_usage_threshold: number;
  credit_expiry_days?: number;
  auto_top_up_enabled: boolean;
  auto_top_up_threshold: number;
  auto_top_up_amount: number;
}

// Billing and Subscription Types
export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  plan: CreditPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingHistory {
  id: string;
  organization_id: string;
  subscription_id: string;
  amount_usd: number;
  plan_name: string;
  billing_period_start: string;
  billing_period_end: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoice_url?: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last_four: string;
  brand?: string; // For cards: visa, mastercard, etc.
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: string;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface PlanChangeRequest {
  current_plan_id: string;
  new_plan_id: string;
  effective_date: 'immediate' | 'next_billing_cycle';
  billing_cycle?: 'monthly' | 'annual';
  proration_amount?: number;
}

export interface OrganizationBilling {
  organization_id: string;
  organization_name: string;
  current_subscription: OrganizationSubscription | null;
  payment_methods: PaymentMethod[];
  billing_address: BillingAddress | null;
  billing_history: BillingHistory[];
  upcoming_invoice?: {
    amount_usd: number;
    due_date: string;
    plan_name: string;
  };
}
