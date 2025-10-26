const databaseService = require('./database');

class BillingService {
  
  /**
   * Get organization billing information including subscription, payment methods, and billing history
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Billing information
   */
  static async getOrganizationBilling(organizationId) {
    try {
      console.log(`\n📊 BillingService.getOrganizationBilling called for org: ${organizationId}`);

      // Get organization info
      const orgResult = await databaseService.query(`
        SELECT id, name, created_at
        FROM tblOrganizations
        WHERE id = @organizationId
      `, { organizationId });

      if (!orgResult.recordset || orgResult.recordset.length === 0) {
        console.log(`❌ Organization not found: ${organizationId}`);
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      const organization = orgResult.recordset[0];
      console.log(`✅ Organization found: ${organization.name}`);

      // Get current subscription
      // Try with new columns first, fall back to old schema if columns don't exist
      let subscriptionResult;
      try {
        console.log(`🔍 Querying subscription with ORDER BY updated_at DESC...`);
        subscriptionResult = await databaseService.query(`
          SELECT
            s.id,
            s.organization_id,
            s.plan_id,
            s.status,
            s.current_period_start,
            s.current_period_end,
            s.cancel_at_period_end,
            ISNULL(s.billing_cycle, 'monthly') as billing_cycle,
            s.created_at,
            s.updated_at,
            cp.name as plan_name,
            cp.description as plan_description,
            cp.monthly_credits,
            cp.price_usd,
            ISNULL(cp.annual_price_usd, cp.price_usd * 12 * 0.8) as annual_price_usd,
            ISNULL(cp.billing_cycle, 'monthly') as plan_billing_cycle,
            cp.ai_operators,
            cp.concurrent_calls,
            cp.campaigns_per_month,
            cp.ai_messages,
            cp.team_members,
            cp.extra_minute_cost,
            ISNULL(cp.extra_credit_cost, cp.extra_minute_cost / 60.0) as extra_credit_cost,
            ISNULL(cp.minutes_included, cp.monthly_credits / 60) as minutes_included,
            ISNULL(cp.cost_per_minute, cp.price_usd / NULLIF(cp.monthly_credits / 60.0, 0)) as cost_per_minute,
            ISNULL(cp.is_popular, 0) as is_popular,
            ISNULL(cp.is_enterprise, 0) as is_enterprise
          FROM tblSubscriptions s
          INNER JOIN tblCreditPlans cp ON s.plan_id = cp.id
          WHERE s.organization_id = @organizationId
          ORDER BY s.updated_at DESC
        `, { organizationId });
      } catch (error) {
        // If new columns don't exist, fall back to basic query
        console.log('Falling back to basic subscription query (new columns not found)');
        subscriptionResult = await databaseService.query(`
          SELECT
            s.id,
            s.organization_id,
            s.plan_id,
            s.status,
            s.current_period_start,
            s.current_period_end,
            s.cancel_at_period_end,
            'monthly' as billing_cycle,
            s.created_at,
            s.updated_at,
            cp.name as plan_name,
            cp.description as plan_description,
            cp.monthly_credits,
            cp.price_usd,
            cp.price_usd * 12 * 0.8 as annual_price_usd,
            'monthly' as plan_billing_cycle,
            cp.ai_operators,
            cp.concurrent_calls,
            cp.campaigns_per_month,
            cp.ai_messages,
            cp.team_members,
            cp.extra_minute_cost,
            cp.extra_minute_cost / 60.0 as extra_credit_cost,
            cp.monthly_credits / 60 as minutes_included,
            cp.price_usd / NULLIF(cp.monthly_credits / 60.0, 0) as cost_per_minute,
            0 as is_popular,
            0 as is_enterprise
          FROM tblSubscriptions s
          INNER JOIN tblCreditPlans cp ON s.plan_id = cp.id
          WHERE s.organization_id = @organizationId
          ORDER BY s.updated_at DESC
        `, { organizationId });
      }

      let currentSubscription = null;
      if (subscriptionResult.recordset && subscriptionResult.recordset.length > 0) {
        const sub = subscriptionResult.recordset[0];
        console.log(`✅ Subscription found:`);
        console.log(`   ID: ${sub.id}`);
        console.log(`   Plan ID: ${sub.plan_id}`);
        console.log(`   Plan Name: ${sub.plan_name}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Created At: ${sub.created_at}`);
        console.log(`   Updated At: ${sub.updated_at}`);
        console.log(`   Billing Cycle: ${sub.billing_cycle}`);

        currentSubscription = {
          id: sub.id,
          organization_id: sub.organization_id,
          plan_id: sub.plan_id,
          billing_cycle: sub.billing_cycle || 'monthly',
          plan: {
            id: sub.plan_id,
            name: sub.plan_name,
            description: sub.plan_description,
            monthly_credits: sub.monthly_credits,
            price_usd: sub.price_usd,
            annual_price_usd: sub.annual_price_usd,
            billing_cycle: sub.plan_billing_cycle,
            minutes_included: sub.minutes_included,
            cost_per_minute: sub.cost_per_minute,
            features: {
              ai_operators: sub.ai_operators,
              concurrent_calls: sub.concurrent_calls,
              campaigns_per_month: sub.campaigns_per_month,
              ai_messages: sub.ai_messages,
              team_members: sub.team_members,
              extra_minute_cost: sub.extra_minute_cost,
              extra_credit_cost: sub.extra_credit_cost
            },
            is_popular: sub.is_popular,
            is_enterprise: sub.is_enterprise
          },
          status: sub.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          created_at: sub.created_at,
          updated_at: sub.updated_at
        };
      }

      // Get payment methods
      const paymentMethodsResult = await databaseService.query(`
        SELECT 
          id,
          type,
          last_four,
          brand,
          exp_month,
          exp_year,
          is_default,
          created_at
        FROM tblPaymentMethods
        WHERE organization_id = @organizationId AND is_active = 1
        ORDER BY is_default DESC, created_at DESC
      `, { organizationId });

      const paymentMethods = paymentMethodsResult.recordset || [];

      // Get billing history (last 12 months)
      const billingHistoryResult = await databaseService.query(`
        SELECT TOP 12
          id,
          invoice_number,
          amount_usd,
          tax_amount_usd,
          total_amount_usd,
          plan_name,
          billing_period_start,
          billing_period_end,
          status,
          invoice_url,
          created_at
        FROM tblBillingHistory
        WHERE organization_id = @organizationId
        ORDER BY created_at DESC
      `, { organizationId });

      const billingHistory = billingHistoryResult.recordset || [];

      // Calculate upcoming invoice (if subscription exists)
      let upcomingInvoice = null;
      if (currentSubscription && currentSubscription.status === 'active') {
        // Use annual price for annual plans, monthly price for monthly plans
        const invoiceAmount = currentSubscription.billing_cycle === 'annual'
          ? currentSubscription.plan.annual_price_usd
          : currentSubscription.plan.price_usd;

        upcomingInvoice = {
          amount_usd: invoiceAmount,
          due_date: currentSubscription.current_period_end,
          plan_name: currentSubscription.plan.name
        };
      }

      const response = {
        success: true,
        data: {
          organization_id: organizationId,
          organization_name: organization.name,
          current_subscription: currentSubscription,
          payment_methods: paymentMethods,
          billing_history: billingHistory,
          upcoming_invoice: upcomingInvoice
        }
      };

      console.log(`✅ Returning billing data:`);
      if (currentSubscription) {
        console.log(`   Current subscription plan_id: ${currentSubscription.plan_id}`);
        console.log(`   Current subscription plan name: ${currentSubscription.plan.name}`);
      } else {
        console.log(`   No current subscription`);
      }

      return response;

    } catch (error) {
      console.error('Error getting organization billing:', error);
      return {
        success: false,
        error: 'Failed to get organization billing information'
      };
    }
  }

  /**
   * Create or update subscription for an organization
   * @param {string} organizationId - Organization ID
   * @param {string} planId - Credit plan ID
   * @param {string} paymentMethodId - Payment method ID (optional)
   * @param {Object} billingAddress - Billing address (optional)
   * @param {number} userId - User ID who initiated the action
   * @param {string} billingCycle - Billing cycle: 'monthly' or 'annual' (default: 'monthly')
   * @returns {Promise<Object>} Result of subscription creation/update
   */
  static async createOrUpdateSubscription(organizationId, planId, paymentMethodId, billingAddress, userId, billingCycle = 'monthly') {
    try {
      // Validate plan exists
      const planResult = await databaseService.query(`
        SELECT * FROM tblCreditPlans WHERE id = @planId AND is_active = 1
      `, { planId });

      if (!planResult.recordset || planResult.recordset.length === 0) {
        return {
          success: false,
          error: 'Invalid plan ID'
        };
      }

      const plan = planResult.recordset[0];

      // Check if subscription already exists
      const existingSubResult = await databaseService.query(`
        SELECT id FROM tblSubscriptions WHERE organization_id = @organizationId
      `, { organizationId });

      const subscriptionId = existingSubResult.recordset && existingSubResult.recordset.length > 0 
        ? existingSubResult.recordset[0].id 
        : `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate billing period based on billing cycle
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();

      if (billingCycle === 'annual') {
        // Annual billing: add 12 months
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        // Monthly billing: add 1 month
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      }

      if (existingSubResult.recordset && existingSubResult.recordset.length > 0) {
        // Update existing subscription
        await databaseService.query(`
          UPDATE tblSubscriptions SET
            plan_id = @planId,
            billing_cycle = @billingCycle,
            status = 'active',
            current_period_start = @currentPeriodStart,
            current_period_end = @currentPeriodEnd,
            cancel_at_period_end = 0,
            updated_at = GETDATE()
          WHERE organization_id = @organizationId
        `, {
          organizationId,
          planId,
          billingCycle,
          currentPeriodStart,
          currentPeriodEnd
        });
      } else {
        // Create new subscription
        await databaseService.query(`
          INSERT INTO tblSubscriptions (
            id, organization_id, plan_id, billing_cycle, status,
            current_period_start, current_period_end, cancel_at_period_end
          ) VALUES (
            @subscriptionId, @organizationId, @planId, @billingCycle, 'active',
            @currentPeriodStart, @currentPeriodEnd, 0
          )
        `, {
          subscriptionId,
          organizationId,
          planId,
          billingCycle,
          currentPeriodStart,
          currentPeriodEnd
        });
      }

      // Allocate credits to all users in the organization
      await this.allocateCreditsForPlan(organizationId, plan, userId);

      // Update allocation_reset_date for all users in the organization
      // This resets the billing cycle countdown when plan is purchased
      const resetDate = new Date(currentPeriodEnd);
      resetDate.setHours(0, 0, 0, 0);

      await databaseService.query(`
        UPDATE tblCreditBalances
        SET allocation_reset_date = @resetDate,
            monthly_used = 0,
            last_updated = GETDATE()
        WHERE organization_id = @organizationId
      `, {
        organizationId,
        resetDate
      });

      console.log(`✅ Updated allocation_reset_date to ${resetDate} for all users in organization ${organizationId}`);

      // Create billing history record
      await this.createBillingRecord(organizationId, subscriptionId, plan, currentPeriodStart, currentPeriodEnd);

      return {
        success: true,
        data: {
          subscription_id: subscriptionId,
          organization_id: organizationId,
          plan_id: planId,
          status: 'active',
          message: 'Subscription created/updated successfully'
        }
      };

    } catch (error) {
      console.error('Error creating/updating subscription:', error);
      return {
        success: false,
        error: 'Failed to create/update subscription'
      };
    }
  }

  /**
   * Allocate credits to all users in an organization based on plan
   * @param {string} organizationId - Organization ID
   * @param {Object} plan - Credit plan object
   * @param {number} adminUserId - Admin user ID who initiated the action
   */
  static async allocateCreditsForPlan(organizationId, plan, adminUserId) {
    try {
      // Get all users in the organization
      const usersResult = await databaseService.query(`
        SELECT id FROM tblUsers 
        WHERE organization_id = @organizationId AND is_active = 1
      `, { organizationId });

      const users = usersResult.recordset || [];

      // Allocate credits to each user
      for (const user of users) {
        // Use CreditService to allocate credits
        const CreditService = require('./CreditService');
        await CreditService.allocateCredits(
          user.id, 
          plan.monthly_credits, 
          adminUserId, 
          `Monthly allocation for ${plan.name} plan`
        );
      }

    } catch (error) {
      console.error('Error allocating credits for plan:', error);
      throw error;
    }
  }

  /**
   * Create billing history record
   * @param {string} organizationId - Organization ID
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} plan - Credit plan object
   * @param {Date} periodStart - Billing period start
   * @param {Date} periodEnd - Billing period end
   */
  static async createBillingRecord(organizationId, subscriptionId, plan, periodStart, periodEnd) {
    try {
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      await databaseService.query(`
        INSERT INTO tblBillingHistory (
          organization_id, subscription_id, invoice_number, amount_usd, 
          tax_amount_usd, total_amount_usd, plan_name, plan_id,
          billing_period_start, billing_period_end, status
        ) VALUES (
          @organizationId, @subscriptionId, @invoiceNumber, @amountUsd,
          0, @amountUsd, @planName, @planId,
          @periodStart, @periodEnd, 'paid'
        )
      `, {
        organizationId,
        subscriptionId,
        invoiceNumber,
        amountUsd: plan.price_usd,
        planName: plan.name,
        planId: plan.id,
        periodStart,
        periodEnd
      });

    } catch (error) {
      console.error('Error creating billing record:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} organizationId - Organization ID
   * @param {boolean} cancelAtPeriodEnd - Whether to cancel at period end or immediately
   * @param {number} userId - User ID who initiated the action
   * @returns {Promise<Object>} Result of cancellation
   */
  static async cancelSubscription(organizationId, cancelAtPeriodEnd, userId) {
    try {
      const result = await databaseService.query(`
        UPDATE tblSubscriptions SET
          cancel_at_period_end = @cancelAtPeriodEnd,
          status = @status,
          updated_at = GETDATE()
        WHERE organization_id = @organizationId
      `, {
        organizationId,
        cancelAtPeriodEnd: cancelAtPeriodEnd ? 1 : 0,
        status: cancelAtPeriodEnd ? 'active' : 'cancelled'
      });

      return {
        success: true,
        data: {
          organization_id: organizationId,
          cancel_at_period_end: cancelAtPeriodEnd,
          status: cancelAtPeriodEnd ? 'active' : 'cancelled',
          message: cancelAtPeriodEnd ? 'Subscription will be cancelled at period end' : 'Subscription cancelled immediately'
        }
      };

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return {
        success: false,
        error: 'Failed to cancel subscription'
      };
    }
  }

  /**
   * Add payment method
   * @param {string} organizationId - Organization ID
   * @param {Object} paymentMethodData - Payment method data
   * @param {number} userId - User ID who initiated the action
   * @returns {Promise<Object>} Result of adding payment method
   */
  static async addPaymentMethod(organizationId, paymentMethodData, userId) {
    try {
      const paymentMethodId = `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // If this is set as default, unset other default payment methods
      if (paymentMethodData.is_default) {
        await databaseService.query(`
          UPDATE tblPaymentMethods SET is_default = 0
          WHERE organization_id = @organizationId
        `, { organizationId });
      }

      await databaseService.query(`
        INSERT INTO tblPaymentMethods (
          id, organization_id, type, last_four, brand,
          exp_month, exp_year, is_default, stripe_payment_method_id
        ) VALUES (
          @paymentMethodId, @organizationId, @type, @lastFour, @brand,
          @expMonth, @expYear, @isDefault, @stripePaymentMethodId
        )
      `, {
        paymentMethodId,
        organizationId,
        type: paymentMethodData.type,
        lastFour: paymentMethodData.last_four,
        brand: paymentMethodData.brand,
        expMonth: paymentMethodData.exp_month,
        expYear: paymentMethodData.exp_year,
        isDefault: paymentMethodData.is_default ? 1 : 0,
        stripePaymentMethodId: paymentMethodData.stripe_payment_method_id || null
      });

      return {
        success: true,
        data: {
          id: paymentMethodId,
          type: paymentMethodData.type,
          last_four: paymentMethodData.last_four,
          brand: paymentMethodData.brand,
          exp_month: paymentMethodData.exp_month,
          exp_year: paymentMethodData.exp_year,
          is_default: paymentMethodData.is_default,
          created_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error adding payment method:', error);
      return {
        success: false,
        error: 'Failed to add payment method'
      };
    }
  }

  /**
   * Get payment methods for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Payment methods
   */
  static async getPaymentMethods(organizationId) {
    try {
      const result = await databaseService.query(`
        SELECT
          id, type, last_four, brand, exp_month, exp_year, is_default, created_at
        FROM tblPaymentMethods
        WHERE organization_id = @organizationId AND is_active = 1
        ORDER BY is_default DESC, created_at DESC
      `, { organizationId });

      return {
        success: true,
        data: result.recordset || []
      };

    } catch (error) {
      console.error('Error getting payment methods:', error);
      return {
        success: false,
        error: 'Failed to get payment methods'
      };
    }
  }

  /**
   * Remove payment method
   * @param {string} paymentMethodId - Payment method ID
   * @param {number} userId - User ID who initiated the action
   * @returns {Promise<Object>} Result of removal
   */
  static async removePaymentMethod(paymentMethodId, userId) {
    try {
      await databaseService.query(`
        UPDATE tblPaymentMethods SET
          is_active = 0,
          updated_at = GETDATE()
        WHERE id = @paymentMethodId
      `, { paymentMethodId });

      return {
        success: true,
        data: {
          id: paymentMethodId,
          message: 'Payment method removed successfully'
        }
      };

    } catch (error) {
      console.error('Error removing payment method:', error);
      return {
        success: false,
        error: 'Failed to remove payment method'
      };
    }
  }

  /**
   * Get billing history
   * @param {string} organizationId - Organization ID
   * @param {number} limit - Number of records to return
   * @param {number} offset - Number of records to skip
   * @returns {Promise<Object>} Billing history
   */
  static async getBillingHistory(organizationId, limit, offset) {
    try {
      const result = await databaseService.query(`
        SELECT
          id, invoice_number, amount_usd, tax_amount_usd, total_amount_usd,
          plan_name, billing_period_start, billing_period_end, status,
          invoice_url, created_at
        FROM tblBillingHistory
        WHERE organization_id = @organizationId
        ORDER BY created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `, { organizationId, limit, offset });

      return {
        success: true,
        data: result.recordset || []
      };

    } catch (error) {
      console.error('Error getting billing history:', error);
      return {
        success: false,
        error: 'Failed to get billing history'
      };
    }
  }

  /**
   * Calculate days remaining in billing period
   */
  static calculateDaysRemaining(periodEndDate) {
    const now = new Date();
    const end = new Date(periodEndDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Calculate total days in billing period
   */
  static calculateTotalDays(periodStartDate, periodEndDate) {
    const start = new Date(periodStartDate);
    const end = new Date(periodEndDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Calculate proration for plan upgrade
   */
  static calculateUpgradeProration(oldPlan, newPlan, daysRemaining, totalDays) {
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
      accountCredit: Math.max(0, -chargeAmount),
      prorationFactor
    };
  }

  /**
   * Calculate proration for plan downgrade
   */
  static calculateDowngradeProration(oldPlan, newPlan, currentBalance, daysRemaining, totalDays) {
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
      prorationFactor
    };
  }

  /**
   * Change subscription plan with proper credit handling
   * @param {string} organizationId - Organization ID
   * @param {string} newPlanId - New plan ID
   * @param {string} effectiveDate - When to apply the change ('immediate' or 'next_billing_cycle')
   * @param {string} billingCycle - Billing cycle ('monthly' or 'annual')
   * @param {number} userId - User ID who initiated the action
   * @returns {Promise<Object>} Result of plan change
   */
  static async changePlan(organizationId, newPlanId, effectiveDate, billingCycle = 'monthly', userId) {
    try {
      // Validate new plan exists
      const planResult = await databaseService.query(`
        SELECT * FROM tblCreditPlans WHERE id = @planId AND is_active = 1
      `, { planId: newPlanId });

      if (!planResult.recordset || planResult.recordset.length === 0) {
        return {
          success: false,
          error: 'Invalid plan ID'
        };
      }

      const newPlan = planResult.recordset[0];

      // Get current subscription
      const subResult = await databaseService.query(`
        SELECT * FROM tblSubscriptions WHERE organization_id = @organizationId
      `, { organizationId });

      if (!subResult.recordset || subResult.recordset.length === 0) {
        return {
          success: false,
          error: 'No active subscription found'
        };
      }

      const currentSub = subResult.recordset[0];

      // Prevent changing to same plan
      if (currentSub.plan_id === newPlanId && currentSub.billing_cycle === billingCycle) {
        return {
          success: false,
          error: 'Already subscribed to this plan and billing cycle'
        };
      }

      // Get old plan details
      const oldPlanResult = await databaseService.query(`
        SELECT * FROM tblCreditPlans WHERE id = @planId AND is_active = 1
      `, { planId: currentSub.plan_id });

      const oldPlan = oldPlanResult.recordset[0];

      if (effectiveDate === 'immediate') {
        // Calculate proration
        const daysRemaining = this.calculateDaysRemaining(currentSub.current_period_end);
        const totalDays = this.calculateTotalDays(currentSub.current_period_start, currentSub.current_period_end);

        console.log(`📊 Plan change proration: ${daysRemaining}/${totalDays} days remaining (${Math.round(daysRemaining/totalDays*100)}%)`);

        // Get all users in organization
        const usersResult = await databaseService.query(`
          SELECT id FROM tblUsers
          WHERE organization_id = @organizationId AND is_active = 1
        `, { organizationId });

        const users = usersResult.recordset || [];
        const isUpgrade = newPlan.monthly_credits > oldPlan.monthly_credits;

        console.log(`🔄 Processing ${isUpgrade ? 'UPGRADE' : 'DOWNGRADE'} from ${oldPlan.name} to ${newPlan.name} for ${users.length} users`);

        // Process credit adjustments for each user
        const CreditService = require('./CreditService');

        for (const user of users) {
          // Get current balance
          const balanceResult = await CreditService.getUserCreditBalance(user.id);

          if (!balanceResult.success) {
            console.error(`❌ Failed to get balance for user ${user.id}`);
            continue;
          }

          const currentBalance = balanceResult.data.currentBalance;

          if (isUpgrade) {
            // UPGRADE: Add prorated credit difference
            const proration = this.calculateUpgradeProration(
              oldPlan,
              newPlan,
              daysRemaining,
              totalDays
            );

            if (proration.creditsToAdd > 0) {
              await CreditService.adjustCredits(
                user.id,
                proration.creditsToAdd,
                userId,
                `Prorated upgrade from ${oldPlan.name} to ${newPlan.name} (${Math.round(proration.prorationFactor * 100)}% of billing period remaining)`,
                'plan_upgrade'
              );
            }

            console.log(`  ✅ User ${user.id}: +${proration.creditsToAdd} credits, charge $${proration.chargeAmount.toFixed(2)}`);

          } else {
            // DOWNGRADE: Handle excess credits
            const proration = this.calculateDowngradeProration(
              oldPlan,
              newPlan,
              currentBalance,
              daysRemaining,
              totalDays
            );

            if (proration.excessCredits > 0) {
              // Forfeit excess credits
              await CreditService.adjustCredits(
                user.id,
                -proration.excessCredits,
                userId,
                `Downgrade adjustment from ${oldPlan.name} to ${newPlan.name} - excess credits forfeited`,
                'plan_downgrade'
              );
            }

            console.log(`  ✅ User ${user.id}: -${proration.excessCredits} excess credits, account credit $${proration.accountCredit.toFixed(2)}`);
          }
        }

        // Update subscription with new billing period
        const newPeriodStart = new Date();
        const newPeriodEnd = new Date();

        if (billingCycle === 'annual') {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        } else {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        }

        await databaseService.query(`
          UPDATE tblSubscriptions SET
            plan_id = @newPlanId,
            billing_cycle = @billingCycle,
            current_period_start = @newPeriodStart,
            current_period_end = @newPeriodEnd,
            status = 'active',
            cancel_at_period_end = 0,
            updated_at = GETDATE()
          WHERE organization_id = @organizationId
        `, {
          organizationId,
          newPlanId,
          billingCycle,
          newPeriodStart,
          newPeriodEnd
        });

        // Update allocation_reset_date for all users in the organization
        // This resets the billing cycle countdown when plan is changed
        const resetDate = new Date(newPeriodEnd);
        resetDate.setHours(0, 0, 0, 0);

        await databaseService.query(`
          UPDATE tblCreditBalances
          SET allocation_reset_date = @resetDate,
              monthly_used = 0,
              last_updated = GETDATE()
          WHERE organization_id = @organizationId
        `, {
          organizationId,
          resetDate
        });

        console.log(`✅ Updated allocation_reset_date to ${resetDate} for all users in organization ${organizationId}`);

        // Determine change type
        let changeType = 'same_tier';
        if (newPlan.monthly_credits > oldPlan.monthly_credits) {
          changeType = 'upgrade';
        } else if (newPlan.monthly_credits < oldPlan.monthly_credits) {
          changeType = 'downgrade';
        } else if (billingCycle !== currentSub.billing_cycle) {
          changeType = 'cycle_change';
        }

        // Log to audit trail
        try {
          await databaseService.query(`
            INSERT INTO tblPlanChangeHistory (
              organization_id, old_plan_id, new_plan_id,
              old_billing_cycle, new_billing_cycle, change_type,
              effective_date, users_affected, changed_by
            ) VALUES (
              @organizationId, @oldPlanId, @newPlanId,
              @oldBillingCycle, @newBillingCycle, @changeType,
              GETDATE(), @usersAffected, @changedBy
            )
          `, {
            organizationId,
            oldPlanId: oldPlan.id,
            newPlanId: newPlan.id,
            oldBillingCycle: currentSub.billing_cycle,
            newBillingCycle: billingCycle,
            changeType,
            usersAffected: users.length,
            changedBy: userId
          });
        } catch (auditError) {
          console.error('⚠️  Failed to log plan change to audit trail:', auditError);
          // Don't fail the entire operation if audit logging fails
        }

        console.log(`✅ Plan change complete: ${oldPlan.name} → ${newPlan.name} (${billingCycle})`);

        return {
          success: true,
          message: `Plan changed from ${oldPlan.name} to ${newPlan.name}`,
          data: {
            oldPlan: oldPlan.name,
            newPlan: newPlan.name,
            billingCycle,
            effectiveDate: 'immediate',
            usersAffected: users.length,
            newPeriodStart,
            newPeriodEnd,
            changeType
          }
        };

      } else if (effectiveDate === 'next_billing_cycle') {
        // Schedule plan change for next billing date
        // Note: This requires adding scheduled_plan_id and scheduled_billing_cycle columns
        console.log(`📅 Scheduling plan change to ${newPlan.name} for next billing cycle`);

        return {
          success: true,
          message: `Plan change scheduled for next billing cycle`,
          data: {
            oldPlan: oldPlan.name,
            newPlan: newPlan.name,
            billingCycle,
            effectiveDate: currentSub.current_period_end,
            note: 'Scheduled plan changes require database schema update (scheduled_plan_id column)'
          }
        };

      } else {
        return {
          success: false,
          error: 'Invalid effective date. Must be "immediate" or "next_billing_cycle"'
        };
      }

    } catch (error) {
      console.error('Error changing plan:', error);
      return {
        success: false,
        error: 'Failed to change plan',
        details: error.message
      };
    }
  }
}

module.exports = BillingService;
