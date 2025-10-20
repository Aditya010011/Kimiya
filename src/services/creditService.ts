import {
  CreditBalance,
  CreditTransaction,
  UsageMetrics,
  CreditAllocation,
  CreditPlan,
  UserCreditSummary,
  AdminCreditOverview,
  CreditUsageChart,
  CreditAlert,
  CreditApiResponse,
  CreditFilters,
  CreditExportOptions,
  CreditRates,
  CreditSystemConfig,
  OrganizationSubscription,
  BillingHistory,
  PaymentMethod,
  BillingAddress,
  PlanChangeRequest,
  OrganizationBilling
} from '@/types/creditTypes';
import { getApiBaseUrl } from '@/utils/envConfig';
import { TokenManager, AuthService } from './authService';

export class CreditService {
  private static baseUrl = getApiBaseUrl();

  // Credit Plans - Hybrid Pricing Model (Competitive with Bland AI, Vapi AI, Retell AI)
  // 1 credit = 1 second of call time OR 1 chat message
  static readonly CREDIT_PLANS: CreditPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      description: '500 mins / month (30,000 credits)',
      monthly_credits: 30000, // 500 minutes * 60 seconds = 30,000 credits for calls
      price_usd: 49,
      annual_price_usd: 470.40, // $49 * 12 * 0.8 = 20% discount
      billing_cycle: 'monthly',
      features: {
        ai_operators: 2,
        concurrent_calls: 5,
        campaigns_per_month: 5,
        ai_messages: 2000, // 2,000 chat messages included
        team_members: 3,
        extra_minute_cost: 0.40, // $0.40 per minute overage
        extra_credit_cost: 0.0067 // $0.40 / 60 seconds = $0.0067 per credit
      },
      minutes_included: 500,
      cost_per_minute: 0.098 // $49 / 500 minutes = $0.098/min
    },
    {
      id: 'professional',
      name: 'Professional',
      description: '3,000 mins / month (180,000 credits)',
      monthly_credits: 180000, // 3,000 minutes * 60 seconds = 180,000 credits for calls
      price_usd: 299,
      annual_price_usd: 2868.80, // $299 * 12 * 0.8 = 20% discount
      billing_cycle: 'monthly',
      features: {
        ai_operators: 10,
        concurrent_calls: 25,
        campaigns_per_month: 50,
        ai_messages: 10000, // 10,000 chat messages included
        team_members: 15,
        extra_minute_cost: 0.25, // $0.25 per minute overage
        extra_credit_cost: 0.0042 // $0.25 / 60 seconds = $0.0042 per credit
      },
      is_popular: true,
      minutes_included: 3000,
      cost_per_minute: 0.0997 // $299 / 3,000 minutes = $0.0997/min
    },
    {
      id: 'business',
      name: 'Business',
      description: '12,000 mins / month (720,000 credits)',
      monthly_credits: 720000, // 12,000 minutes * 60 seconds = 720,000 credits for calls
      price_usd: 899,
      annual_price_usd: 8630.40, // $899 * 12 * 0.8 = 20% discount
      billing_cycle: 'monthly',
      features: {
        ai_operators: 50,
        concurrent_calls: 100,
        campaigns_per_month: -1, // Unlimited
        ai_messages: 50000, // 50,000 chat messages included
        team_members: 50,
        extra_minute_cost: 0.15, // $0.15 per minute overage
        extra_credit_cost: 0.0025 // $0.15 / 60 seconds = $0.0025 per credit
      },
      minutes_included: 12000,
      cost_per_minute: 0.0749 // $899 / 12,000 minutes = $0.0749/min
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Unlimited minutes (Custom pricing)',
      monthly_credits: -1, // Unlimited
      price_usd: -1, // Contact for pricing
      annual_price_usd: -1, // Custom negotiated pricing
      billing_cycle: 'custom',
      features: {
        ai_operators: -1, // Unlimited
        concurrent_calls: -1, // Unlimited
        campaigns_per_month: -1, // Unlimited
        ai_messages: -1, // Unlimited
        team_members: -1, // Unlimited
        extra_minute_cost: 0, // Negotiated rates
        extra_credit_cost: 0 // Negotiated rates
      },
      is_enterprise: true,
      minutes_included: -1, // Unlimited
      cost_per_minute: 0 // Custom pricing
    }
  ];

  // Credit Rates Configuration
  static readonly CREDIT_RATES: CreditRates = {
    chat_message: 1, // 1 credit per message
    call_per_minute: 60, // 60 credits per minute (1 credit per second)
    storage_per_mb_per_month: 10, // 10 credits per MB per month
    transcription_per_minute: 30, // 30 credits per minute of transcription
    ai_summary: 50, // 50 credits per AI summary
    ai_analysis: 100 // 100 credits per AI analysis
  };

  // System Configuration
  static readonly SYSTEM_CONFIG: CreditSystemConfig = {
    rates: this.CREDIT_RATES,
    default_allocation: 1000, // Default credits for new users
    low_balance_threshold: 100, // Alert when balance is below 100 credits
    high_usage_threshold: 0.8, // Alert when 80% of monthly credits are used
    credit_expiry_days: 365, // Credits expire after 1 year
    auto_top_up_enabled: false,
    auto_top_up_threshold: 50,
    auto_top_up_amount: 500
  };

  /**
   * Get user's current credit balance
   */
  static async getUserCreditBalance(userId: number): Promise<CreditApiResponse<CreditBalance>> {
    try {
      const response = await fetch(`/api/credits/balance/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const balance: CreditBalance = {
          user_id: userId,
          total_credits: data.data.totalCredits || 0,
          available_credits: data.data.currentBalance || 0,
          reserved_credits: data.data.reservedCredits || 0,
          last_updated: data.data.lastUpdated || new Date().toISOString(),
          expires_at: data.data.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        };

        return {
          success: true,
          data: balance
        };
      } else {
        throw new Error(data.error || 'Failed to get credit balance');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get credit balance'
      };
    }
  }

  /**
   * Get user's credit transaction history
   */
  static async getCreditTransactions(
    userId: number,
    filters?: CreditFilters
  ): Promise<CreditApiResponse<CreditTransaction[]>> {
    try {
      const response = await fetch(`/api/credits/transactions/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          data: data.data
        };
      } else {
        throw new Error(data.error || 'Failed to get credit transactions');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get credit transactions'
      };
    }
  }

  /**
   * Get user's usage metrics for a specific period
   */
  static async getUserUsageMetrics(
    userId: number, 
    periodStart: string, 
    periodEnd: string
  ): Promise<CreditApiResponse<UsageMetrics>> {
    try {
      const mockUsage: UsageMetrics = {
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        total_credits_used: 650,
        breakdown: {
          chat_usage: {
            total_credits: 150,
            message_count: 150,
            session_count: 12,
            average_credits_per_message: 1
          },
          inbound_calls: {
            total_credits: 180,
            call_count: 8,
            total_duration_seconds: 180,
            average_credits_per_minute: 60
          },
          outbound_calls: {
            total_credits: 240,
            call_count: 6,
            total_duration_seconds: 240,
            average_credits_per_minute: 60
          },
          storage: {
            total_credits: 30,
            conversation_count: 25,
            data_size_mb: 3
          },
          transcription: {
            total_credits: 30,
            transcription_count: 2,
            total_duration_seconds: 60
          },
          ai_services: {
            summary_credits: 20,
            analysis_credits: 0,
            summary_count: 4,
            analysis_count: 0
          }
        }
      };

      return {
        success: true,
        data: mockUsage
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage metrics'
      };
    }
  }

  /**
   * Get comprehensive user credit summary
   */
  static async getUserCreditSummary(userId: number): Promise<CreditApiResponse<UserCreditSummary>> {
    try {
      const balanceResponse = await this.getUserCreditBalance(userId);
      const usageResponse = await this.getUserUsageMetrics(
        userId,
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        new Date().toISOString()
      );
      const transactionsResponse = await this.getCreditTransactions(userId, { limit: 10 });

      if (!balanceResponse.success || !usageResponse.success || !transactionsResponse.success) {
        throw new Error('Failed to fetch user credit data');
      }

      const mockSummary: UserCreditSummary = {
        user_id: userId,
        user_email: 'user@example.com',
        user_name: 'John Doe',
        current_balance: balanceResponse.data!,
        current_plan: this.CREDIT_PLANS[1], // Professional plan
        usage_this_month: usageResponse.data!,
        recent_transactions: transactionsResponse.data!,
        projected_usage: {
          estimated_monthly_usage: 1200,
          days_remaining_at_current_rate: 45,
          recommended_top_up: 500
        },
        alerts: {
          low_balance: balanceResponse.data!.available_credits < this.SYSTEM_CONFIG.low_balance_threshold,
          high_usage: usageResponse.data!.total_credits_used > (this.CREDIT_PLANS[1].monthly_credits * this.SYSTEM_CONFIG.high_usage_threshold),
          expiring_credits: false
        }
      };

      return {
        success: true,
        data: mockSummary
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user credit summary'
      };
    }
  }

  /**
   * Allocate credits to a user (Admin only)
   */
  static async allocateCredits(
    userId: number,
    amount: number,
    reason: string,
    allocationType: CreditAllocation['allocation_type'] = 'top_up'
  ): Promise<CreditApiResponse<CreditAllocation>> {
    try {
      // Mock allocation - in production, this would be an API call
      const mockAllocation: CreditAllocation = {
        id: Date.now(),
        user_id: userId,
        allocated_by: 1, // Current admin user
        amount,
        allocation_type: allocationType,
        reason,
        created_at: new Date().toISOString(),
        is_active: true
      };

      return {
        success: true,
        data: mockAllocation,
        message: `Successfully allocated ${amount} credits to user ${userId}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate credits'
      };
    }
  }

  /**
   * Get admin overview of all credit usage
   */
  static async getAdminCreditOverview(): Promise<CreditApiResponse<AdminCreditOverview>> {
    try {
      const mockOverview: AdminCreditOverview = {
        total_users: 156,
        total_credits_allocated: 450000,
        total_credits_used: 287500,
        total_credits_remaining: 162500,
        users_with_low_balance: 12,
        users_with_high_usage: 8,
        top_users_by_usage: [
          {
            user_id: 1,
            user_email: 'john@company.com',
            user_name: 'John Doe',
            credits_used: 15000,
            percentage_of_total: 5.2
          },
          {
            user_id: 2,
            user_email: 'sarah@company.com',
            user_name: 'Sarah Smith',
            credits_used: 12500,
            percentage_of_total: 4.3
          }
        ],
        usage_by_service: {
          chat: 45000,
          inbound_calls: 89000,
          outbound_calls: 125000,
          storage: 15000,
          transcription: 8500,
          ai_services: 5000
        },
        recent_allocations: []
      };

      return {
        success: true,
        data: mockOverview
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get admin credit overview'
      };
    }
  }

  /**
   * Get organization billing information
   */
  static async getOrganizationBilling(organizationId: string): Promise<CreditApiResponse<OrganizationBilling>> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `/api/billing/organization/${organizationId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization billing'
      };
    }
  }

  /**
   * Subscribe to a plan
   */
  static async subscribeToPlan(
    organizationId: string,
    planId: string,
    billingCycle: 'monthly' | 'annual' = 'monthly',
    paymentMethodId?: string,
    billingAddress?: BillingAddress
  ): Promise<CreditApiResponse<OrganizationSubscription>> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `/api/billing/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            planId,
            billingCycle,
            paymentMethodId,
            billingAddress
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Dispatch custom event to trigger credit balance refresh
      if (data.success) {
        const plan = this.CREDIT_PLANS.find(p => p.id === planId);
        window.dispatchEvent(new CustomEvent('planPurchased', {
          detail: {
            planId,
            billingCycle,
            credits: plan?.monthly_credits || 0
          }
        }));
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe to plan'
      };
    }
  }

  /**
   * Change subscription plan
   */
  static async changePlan(organizationId: string, planChangeRequest: PlanChangeRequest): Promise<CreditApiResponse<OrganizationSubscription>> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `/api/billing/change-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            newPlanId: planChangeRequest.new_plan_id,
            effectiveDate: planChangeRequest.effective_date || 'immediate',
            billingCycle: planChangeRequest.billing_cycle || 'monthly'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Dispatch custom event to trigger credit balance refresh
      if (data.success) {
        const plan = this.CREDIT_PLANS.find(p => p.id === planChangeRequest.new_plan_id);
        window.dispatchEvent(new CustomEvent('planChanged', {
          detail: {
            planId: planChangeRequest.new_plan_id,
            billingCycle: planChangeRequest.billing_cycle || 'monthly',
            credits: plan?.monthly_credits || 0
          }
        }));
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change plan'
      };
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(organizationId: string, cancelAtPeriodEnd: boolean = true): Promise<CreditApiResponse<OrganizationSubscription>> {
    try {
      // Mock subscription cancellation
      const mockCancelledSubscription: OrganizationSubscription = {
        id: 'sub_1234567890',
        organization_id: organizationId,
        plan_id: 'professional',
        plan: this.CREDIT_PLANS[1],
        status: cancelAtPeriodEnd ? 'active' : 'cancelled',
        current_period_start: '2024-01-01T00:00:00Z',
        current_period_end: '2024-02-01T00:00:00Z',
        cancel_at_period_end: cancelAtPeriodEnd,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      };

      return {
        success: true,
        data: mockCancelledSubscription
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      };
    }
  }

  /**
   * Add payment method
   */
  static async addPaymentMethod(organizationId: string, paymentMethodData: Partial<PaymentMethod>): Promise<CreditApiResponse<PaymentMethod>> {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `/api/billing/payment-methods`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            ...paymentMethodData
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add payment method'
      };
    }
  }

  /**
   * Update billing address
   */
  static async updateBillingAddress(organizationId: string, billingAddress: BillingAddress): Promise<CreditApiResponse<BillingAddress>> {
    try {
      // Mock updating billing address
      return {
        success: true,
        data: billingAddress
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update billing address'
      };
    }
  }
}
