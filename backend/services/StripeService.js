const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const databaseService = require('./database');
const stripeProducts = require('../config/stripe-products.json');

class StripeService {
  /**
   * Create or get Stripe customer
   * @param {string} organizationId - Organization ID
   * @param {string} email - Customer email
   * @param {string} name - Customer name
   * @returns {Promise<Object>} Stripe customer object
   */
  static async createOrGetCustomer(organizationId, email, name) {
    try {
      // Check if customer already exists in database
      const existingResult = await databaseService.query(`
        SELECT TOP (1) stripe_customer_id FROM tblSubscriptions
        WHERE organization_id = @organizationId AND stripe_customer_id IS NOT NULL
      `, { organizationId });

      if (existingResult.recordset && existingResult.recordset.length > 0) {
        const customerId = existingResult.recordset[0].stripe_customer_id;
        return await stripe.customers.retrieve(customerId);
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          organizationId,
          createdAt: new Date().toISOString()
        }
      });

      return customer;
    } catch (error) {
      console.error('Error creating/getting Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create checkout session for subscription
   * @param {string} organizationId - Organization ID
   * @param {string} planId - Plan ID (starter, professional, business, enterprise)
   * @param {string} billingCycle - Billing cycle (monthly or annual)
   * @param {string} email - Customer email
   * @param {number} userId - User ID making the purchase (for credit allocation)
   * @param {string} successUrl - URL to redirect on success
   * @param {string} cancelUrl - URL to redirect on cancel
   * @returns {Promise<Object>} Checkout session
   */
  static async createCheckoutSession(organizationId, planId, billingCycle, email, userId, successUrl, cancelUrl) {
    try {
      // ✅ FIX 4: Validate all required parameters
      if (!organizationId || !planId || !billingCycle) {
        throw new Error(`Missing required parameters: organizationId=${organizationId}, planId=${planId}, billingCycle=${billingCycle}`);
      }

      const plan = stripeProducts.products[planId];
      if (!plan) {
        throw new Error(`Plan ${planId} not found in stripe-products.json`);
      }

      const priceId = plan.prices[billingCycle]?.id;
      if (!priceId) {
        throw new Error(`Price for ${planId} ${billingCycle} not found in stripe-products.json`);
      }

      console.log(`Creating checkout session for org ${organizationId}, plan ${planId}, cycle ${billingCycle}, user ${userId}`);
      console.log(`   Using price ID: ${priceId}`);
      console.log(`   Price amount: ${plan.prices[billingCycle].amount}`);
      console.log(`   Price interval: ${plan.prices[billingCycle].interval}`);

      // Get or create customer
      const customer = await this.createOrGetCustomer(organizationId, email, `Org: ${organizationId}`);
      console.log(`Using Stripe customer: ${customer.id}`);

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: 'auto',
        metadata: {
          organizationId,
          planId,
          billingCycle,
          userId: String(userId) // ✅ Add userId to metadata for webhook
        }
      });

      console.log(`✅ Checkout session created: ${session.id}`);
      console.log(`   Metadata: organizationId=${organizationId}, planId=${planId}, billingCycle=${billingCycle}`);

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get Stripe subscription details
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Subscription details
   */
  static async getSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel Stripe subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {boolean} immediate - Cancel immediately or at period end
   * @returns {Promise<Object>} Cancelled subscription
   */
  static async cancelSubscription(subscriptionId, immediate = false) {
    try {
      if (immediate) {
        return await stripe.subscriptions.del(subscriptionId);
      } else {
        return await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription (change plan)
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {string} newPriceId - New price ID
   * @returns {Promise<Object>} Updated subscription
   */
  static async updateSubscription(subscriptionId, newPriceId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Get current subscription item
      const currentItem = subscription.items.data[0];

      // Update subscription with new price
      return await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: newPriceId
          }
        ],
        proration_behavior: 'create_prorations'
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {string} body - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Verified event
   */
  static verifyWebhookSignature(body, signature) {
    try {
      return stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Get plan ID from Stripe price ID
   * @param {string} priceId - Stripe price ID
   * @returns {string} Plan ID
   */
  static getPlanIdFromPrice(priceId) {
    return stripeProducts.priceIdToPlanMap[priceId];
  }

  /**
   * Get plan details
   * @param {string} planId - Plan ID
   * @returns {Object} Plan details
   */
  static getPlanDetails(planId) {
    return stripeProducts.products[planId];
  }

  /**
   * Get price ID for plan and billing cycle
   * @param {string} planId - Plan ID
   * @param {string} billingCycle - Billing cycle (monthly or annual)
   * @returns {string} Price ID
   */
  static getPriceId(planId, billingCycle) {
    const plan = stripeProducts.products[planId];
    if (!plan) return null;
    return plan.prices[billingCycle]?.id;
  }
}

module.exports = StripeService;

