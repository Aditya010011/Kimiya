const express = require('express');
const router = express.Router();
const StripeService = require('../services/StripeService');
const BillingService = require('../services/BillingService');
const CreditService = require('../services/CreditService');
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

// ✅ FIX: Add JSON parsing middleware for all routes EXCEPT webhook
// The webhook needs raw body for signature verification
router.use((req, res, next) => {
  // Skip JSON parsing for webhook endpoint (it needs raw body)
  if (req.path === '/webhook') {
    return next();
  }
  // Parse JSON for all other routes
  express.json()(req, res, next);
});

/**
 * POST /api/stripe/checkout-session
 * Create a Stripe checkout session for subscription
 */
router.post('/checkout-session', authenticateToken, async (req, res) => {
  try {
    const { organizationId, planId, billingCycle = 'monthly' } = req.body;

    console.log(`\n🛒 POST /api/stripe/checkout-session called`);
    console.log(`   User ID: ${req.user.id}`);
    console.log(`   User: ${req.user.email}`);
    console.log(`   User organization_id: ${req.user.organization_id}`);
    console.log(`   Request organizationId: ${organizationId}`);
    console.log(`   Request planId: ${planId}`);
    console.log(`   Request billingCycle: ${billingCycle}`);

    if (!organizationId || !planId) {
      console.error('❌ Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Organization ID and Plan ID are required'
      });
    }

    // Get organization details
    const orgResult = await databaseService.query(`
      SELECT id, name, email FROM tblOrganizations WHERE id = @organizationId
    `, { organizationId });

    if (!orgResult.recordset || orgResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const org = orgResult.recordset[0];

    // Create checkout session
    // Use WEBHOOK_BASE_URL for frontend URLs (this is the public-facing domain)
    const frontendBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:5173';
    const session = await StripeService.createCheckoutSession(
      organizationId,
      planId,
      billingCycle,
      org.email,
      req.user.id, // ✅ Pass the user ID who is making the purchase
      `${frontendBaseUrl}/billing/success`,
      `${frontendBaseUrl}/billing/cancel`
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log(`\n🔔 WEBHOOK ENDPOINT HIT: POST /api/stripe/webhook`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Headers: ${JSON.stringify(req.headers)}`);

  const sig = req.headers['stripe-signature'];

  try {
    // ✅ FIX 5: Validate webhook signature is present
    if (!sig) {
      console.error('❌ CRITICAL: Webhook received without Stripe signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    console.log(`🔔 Webhook received with signature: ${sig.substring(0, 20)}...`);

    let event;
    try {
      event = StripeService.verifyWebhookSignature(req.body, sig);
      console.log(`✅ Webhook signature verified successfully`);
    } catch (error) {
      console.error(`❌ Webhook signature verification failed: ${error.message}`);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log(`🔔 Processing Stripe event: ${event.type}`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Created: ${new Date(event.created * 1000).toISOString()}`);

    // ✅ FIX: Check if this event has already been processed (idempotency)
    const eventAlreadyProcessed = await checkWebhookEventProcessed(event.id);
    if (eventAlreadyProcessed) {
      console.log(`⚠️  Event ${event.id} already processed. Skipping to prevent duplicate processing.`);
      return res.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        console.log(`   → Handling checkout.session.completed`);
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        console.log(`   → Handling customer.subscription.updated`);
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log(`   → Handling customer.subscription.deleted`);
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log(`   → Handling invoice.payment_succeeded`);
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        console.log(`   → Handling invoice.payment_failed`);
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`⚠️  Unhandled event type: ${event.type}`);
    }

    // ✅ Record this event as processed for idempotency
    // Extract organizationId from the event data
    let organizationId = null;
    if (event.data.object.metadata && event.data.object.metadata.organizationId) {
      organizationId = event.data.object.metadata.organizationId;
    } else if (event.data.object.customer) {
      // For subscription events, we might need to look up the organization
      organizationId = 'org_default_123'; // Fallback - in production, look this up
    }

    if (organizationId) {
      await recordWebhookEvent(event.id, event.type, organizationId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session) {
  try {
    const { organizationId, planId, billingCycle = 'monthly', userId } = session.metadata;

    // ✅ FIX 1: Validate metadata is present
    if (!organizationId || !planId) {
      console.error('❌ CRITICAL: Missing metadata in checkout session');
      console.error(`   Session ID: ${session.id}`);
      console.error(`   Metadata: ${JSON.stringify(session.metadata)}`);
      console.error(`   organizationId: ${organizationId}`);
      console.error(`   planId: ${planId}`);
      throw new Error('Missing required metadata: organizationId and planId must be provided');
    }

    console.log(`✅ Checkout completed for org ${organizationId}, plan ${planId}, cycle ${billingCycle}`);
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Customer ID: ${session.customer}`);
    console.log(`   Subscription ID: ${session.subscription}`);
    console.log(`   User ID (purchaser): ${userId}`);
    console.log(`   Full metadata: ${JSON.stringify(session.metadata)}`);

    // Get subscription details (if subscription exists)
    let subscription = null;
    console.log(`   Session subscription ID: ${session.subscription}`);
    if (session.subscription) {
      try {
        // Retry logic in case subscription is not immediately available
        let retries = 3;
        let lastError = null;

        while (retries > 0 && !subscription) {
          try {
            subscription = await StripeService.getSubscription(session.subscription);
            console.log(`   ✅ Retrieved Stripe subscription details`);
            console.log(`   Stripe Subscription ID: ${subscription.id}`);
            console.log(`   Subscription status: ${subscription.status}`);
            console.log(`   Subscription items: ${subscription.items?.data?.length || 0}`);
            if (subscription.items?.data?.length > 0) {
              console.log(`   First item price ID: ${subscription.items.data[0].price?.id}`);
              console.log(`   First item price interval: ${subscription.items.data[0].price?.recurring?.interval}`);
              console.log(`   First item price amount: ${subscription.items.data[0].price?.unit_amount}`);
            }
            console.log(`   Subscription current_period_start: ${new Date(subscription.current_period_start * 1000).toISOString()}`);
            console.log(`   Subscription current_period_end: ${new Date(subscription.current_period_end * 1000).toISOString()}`);
            break;
          } catch (err) {
            lastError = err;
            retries--;
            if (retries > 0) {
              console.log(`   ⏳ Retry ${4 - retries}/3: Waiting for subscription to be available...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
          }
        }

        if (!subscription && lastError) {
          console.error(`   ❌ Error retrieving subscription after retries: ${lastError.message}`);
        }
      } catch (err) {
        console.error(`   ❌ Unexpected error: ${err.message}`);
        subscription = null;
      }
    } else {
      console.log(`   ℹ️  No subscription ID in session`);
    }

    // Safely log subscription dates if subscription exists
    if (subscription) {
      if (subscription.current_period_start && !isNaN(subscription.current_period_start)) {
        try {
          console.log(`   Current Period Start: ${new Date(subscription.current_period_start * 1000).toISOString()}`);
        } catch (e) {
          console.log(`   Current Period Start: ${subscription.current_period_start}`);
        }
      }

      if (subscription.current_period_end && !isNaN(subscription.current_period_end)) {
        try {
          console.log(`   Current Period End: ${new Date(subscription.current_period_end * 1000).toISOString()}`);
        } catch (e) {
          console.log(`   Current Period End: ${subscription.current_period_end}`);
        }
      }
    } else {
      console.log(`   ℹ️  No subscription for this checkout (one-time payment)`);
    }

    // ✅ FIX 2: Update or create subscription in database with detailed logging
    console.log(`   Checking for existing subscription for org ${organizationId}...`);
    const existingResult = await databaseService.query(`
      SELECT id, plan_id as old_plan_id FROM tblSubscriptions WHERE organization_id = @organizationId
    `, { organizationId });

    const now = new Date();
    // Calculate period end based on billing cycle
    let periodEnd;
    console.log(`   Subscription object exists: ${!!subscription}`);
    console.log(`   Subscription current_period_end: ${subscription?.current_period_end}`);
    console.log(`   Billing cycle: ${billingCycle}`);

    // For annual plans, always calculate 365 days from now
    // For monthly plans, use Stripe's period end or default to 30 days
    if (billingCycle === 'annual') {
      periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      console.log(`   ✅ Annual plan: Setting period end to 365 days from now`);
    } else if (subscription && subscription.current_period_end && !isNaN(subscription.current_period_end)) {
      periodEnd = new Date(subscription.current_period_end * 1000);
      console.log(`   Using Stripe period end for monthly plan: ${periodEnd.toISOString()}`);
      // Validate the date is valid
      if (isNaN(periodEnd.getTime())) {
        console.log(`   ⚠️  Invalid period end from subscription, using default 30 days`);
        periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Default to 30 days from now for one-time payments or invalid subscriptions
      console.log(`   ⚠️  No valid subscription period end, using default 30 days`);
      periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    console.log(`   Final periodEnd: ${periodEnd.toISOString()}`);

    let isPlanChange = false;
    let oldPlanId = null;

    if (existingResult.recordset && existingResult.recordset.length > 0) {
      // Update existing subscription
      oldPlanId = existingResult.recordset[0].old_plan_id;
      isPlanChange = oldPlanId !== planId;
      console.log(`   ✅ Found existing subscription: ${existingResult.recordset[0].id}`);
      console.log(`   Old plan_id: ${oldPlanId}`);
      console.log(`   New plan_id: ${planId}`);
      console.log(`   Is plan change: ${isPlanChange}`);
      console.log(`   Updating subscription with plan_id: ${planId}`);
      console.log(`   Using billingCycle: ${billingCycle}`);

      const updateResult = await databaseService.query(`
        UPDATE tblSubscriptions SET
          plan_id = @planId,
          stripe_subscription_id = @stripeSubscriptionId,
          stripe_customer_id = @stripeCustomerId,
          status = @status,
          current_period_start = @periodStart,
          current_period_end = @periodEnd,
          billing_cycle = @billingCycle,
          updated_at = GETDATE()
        WHERE organization_id = @organizationId
      `, {
        organizationId,
        planId,
        stripeSubscriptionId: subscription ? subscription.id : null,
        stripeCustomerId: session.customer,
        status: 'active',
        periodStart: now,
        periodEnd,
        billingCycle
      });

      console.log(`   ✅ Subscription updated successfully`);
      console.log(`   Rows affected: ${updateResult.rowsAffected ? updateResult.rowsAffected[0] : 'unknown'}`);

      // Update allocation_reset_date for all users in the organization
      const resetDate = new Date(periodEnd);
      resetDate.setHours(0, 0, 0, 0);

      console.log(`   📅 Updating allocation_reset_date:`);
      console.log(`      periodEnd: ${periodEnd.toISOString()}`);
      console.log(`      resetDate: ${resetDate.toISOString()}`);
      console.log(`      billingCycle: ${billingCycle}`);

      const creditUpdateResult = await databaseService.query(`
        UPDATE tblCreditBalances
        SET allocation_reset_date = @resetDate,
            monthly_used = 0,
            last_updated = GETDATE()
        WHERE organization_id = @organizationId
      `, {
        organizationId,
        resetDate
      });

      console.log(`   ✅ Updated allocation_reset_date to ${resetDate} for all users`);
      console.log(`      Rows affected: ${creditUpdateResult.rowsAffected ? creditUpdateResult.rowsAffected[0] : 'unknown'}`);

      // ✅ FIX 7: Verify the update was successful by querying the database
      const verifyResult = await databaseService.query(`
        SELECT plan_id, updated_at FROM tblSubscriptions WHERE organization_id = @organizationId
      `, { organizationId });

      if (verifyResult.recordset && verifyResult.recordset.length > 0) {
        const updated = verifyResult.recordset[0];
        console.log(`   ✅ VERIFICATION: Database now shows plan_id: ${updated.plan_id}`);
        console.log(`   ✅ VERIFICATION: Updated at: ${updated.updated_at}`);
        if (updated.plan_id === planId) {
          console.log(`   ✅ VERIFICATION PASSED: Plan ID matches!`);
        } else {
          console.error(`   ❌ VERIFICATION FAILED: Plan ID mismatch! Expected ${planId}, got ${updated.plan_id}`);
        }
      }
    } else {
      // Create new subscription
      console.log(`   ℹ️  No existing subscription found, creating new one...`);
      const subscriptionId = `sub_${Date.now()}`;

      const insertResult = await databaseService.query(`
        INSERT INTO tblSubscriptions (
          id, organization_id, plan_id, status, current_period_start,
          current_period_end, stripe_subscription_id, stripe_customer_id,
          billing_cycle, created_at, updated_at
        ) VALUES (
          @id, @organizationId, @planId, @status, @periodStart,
          @periodEnd, @stripeSubscriptionId, @stripeCustomerId,
          @billingCycle, GETDATE(), GETDATE()
        )
      `, {
        id: subscriptionId,
        organizationId,
        planId,
        status: 'active',
        periodStart: now,
        periodEnd,
        stripeSubscriptionId: subscription ? subscription.id : null,
        stripeCustomerId: session.customer,
        billingCycle
      });

      console.log(`   ✅ New subscription created: ${subscriptionId}`);
      console.log(`   Rows affected: ${insertResult.rowsAffected ? insertResult.rowsAffected[0] : 'unknown'}`);

      // Update allocation_reset_date for all users in the organization
      const resetDate = new Date(periodEnd);
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

      console.log(`   ✅ Updated allocation_reset_date to ${resetDate} for all users`);
    }

    // ✅ FIX 3: Allocate credits for the plan with logging
    console.log(`   💳 Allocating credits for plan: ${planId}`);
    const plan = StripeService.getPlanDetails(planId);

    if (!plan) {
      console.error(`   ❌ Plan not found: ${planId}`);
      throw new Error(`Plan ${planId} not found in configuration`);
    }

    console.log(`   📊 Plan details: ${plan.name}, ${plan.monthlyCredits} credits`);

    if (plan && plan.monthlyCredits > 0) {
      // ✅ FIX: Only allocate credits to the user who made the purchase
      // Other users should manually request credits from the admin
      if (!userId) {
        console.error(`   ❌ ERROR: userId not found in metadata. Cannot allocate credits.`);
        throw new Error('userId is required in checkout session metadata');
      }

      console.log(`   💳 Allocating credits ONLY to purchasing user: ${userId}`);
      console.log(`   ℹ️  Other users in the organization will have 0 credits until admin allocates to them`);

      // Verify the user exists and belongs to this organization
      const userResult = await databaseService.query(`
        SELECT id, email FROM tblUsers WHERE id = @userId AND organization_id = @organizationId
      `, { userId: parseInt(userId), organizationId });

      if (!userResult.recordset || userResult.recordset.length === 0) {
        console.error(`   ❌ ERROR: User ${userId} not found in organization ${organizationId}`);
        throw new Error(`User ${userId} not found in organization ${organizationId}`);
      }

      const purchasingUser = userResult.recordset[0];
      console.log(`   👤 Purchasing user: ${purchasingUser.email} (ID: ${purchasingUser.id})`);

      const users = [purchasingUser]; // Only allocate to this user

      for (const user of users) {
        if (isPlanChange) {
          // ✅ FIX: For plan changes, REPLACE credits instead of adding
          console.log(`   🔄 Plan change detected (${oldPlanId} → ${planId})`);
          console.log(`   💰 Replacing credits with ${plan.monthlyCredits} credits for user ${user.id}...`);

          const creditResult = await CreditService.replaceCredits(
            user.id,
            plan.monthlyCredits,
            1, // System admin
            `Plan upgrade/downgrade from ${oldPlanId} to ${plan.name}`
          );

          if (creditResult.success) {
            console.log(`   ✅ Credits replaced for user ${user.id}`);
            console.log(`      Transaction ID: ${creditResult.data.transactionId}`);
            console.log(`      Balance before: ${creditResult.data.balanceBefore}`);
            console.log(`      Balance after: ${creditResult.data.balanceAfter}`);
          } else {
            console.error(`   ❌ Failed to replace credits for user ${user.id}: ${creditResult.error}`);
          }
        } else {
          // Initial allocation - ADD credits
          console.log(`   💰 Allocating ${plan.monthlyCredits} credits to user ${user.id}...`);
          const creditResult = await CreditService.allocateCredits(
            user.id,
            plan.monthlyCredits,
            1, // System admin
            `Initial allocation for ${plan.name} subscription`
          );

          if (creditResult.success) {
            console.log(`   ✅ Credits allocated to user ${user.id}`);
            console.log(`      Transaction ID: ${creditResult.data.transactionId}`);
            console.log(`      Balance before: ${creditResult.data.balanceBefore}`);
            console.log(`      Balance after: ${creditResult.data.balanceAfter}`);
          } else {
            console.error(`   ❌ Failed to allocate credits to user ${user.id}: ${creditResult.error}`);
          }
        }
      }

      console.log(`   ✅ Credit allocation completed for all users`);
    } else {
      console.log(`   ℹ️  No credits to allocate (monthlyCredits: ${plan?.monthlyCredits})`);
    }

    console.log(`✅ Subscription completed for org ${organizationId}`);

    // ✅ Record this event as processed for idempotency
    // Note: We need to get the event ID from the parent scope
    // This will be called from the webhook handler
  } catch (error) {
    console.error('Error handling checkout.session.completed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log(`🔄 Subscription updated event received: ${subscription.id}`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Items: ${subscription.items.data.length}`);

    // Find organization by stripe subscription ID
    const result = await databaseService.query(`
      SELECT organization_id FROM tblSubscriptions
      WHERE stripe_subscription_id = @stripeSubscriptionId
    `, { stripeSubscriptionId: subscription.id });

    if (!result.recordset || result.recordset.length === 0) {
      console.log(`❌ Organization not found for subscription ${subscription.id}`);
      return;
    }

    const organizationId = result.recordset[0].organization_id;
    console.log(`   Organization: ${organizationId}`);

    // Get the current plan from Stripe subscription items
    let planId = null;
    if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      // Map Stripe price ID to our plan ID
      const stripeProducts = require('../config/stripe-products.json');
      planId = stripeProducts.priceIdToPlanMap[priceId];
      console.log(`   Plan changed: Price ID ${priceId} -> Plan ID ${planId}`);
    }

    // Update subscription status and plan if changed
    const updateQuery = planId
      ? `
        UPDATE tblSubscriptions SET
          plan_id = @planId,
          status = @status,
          current_period_start = @periodStart,
          current_period_end = @periodEnd,
          updated_at = GETDATE()
        WHERE stripe_subscription_id = @stripeSubscriptionId
      `
      : `
        UPDATE tblSubscriptions SET
          status = @status,
          current_period_start = @periodStart,
          current_period_end = @periodEnd,
          updated_at = GETDATE()
        WHERE stripe_subscription_id = @stripeSubscriptionId
      `;

    // Safely parse dates
    let periodStart = new Date();
    let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (subscription.current_period_start && !isNaN(subscription.current_period_start)) {
      const startDate = new Date(subscription.current_period_start * 1000);
      if (!isNaN(startDate.getTime())) {
        periodStart = startDate;
      }
    }

    if (subscription.current_period_end && !isNaN(subscription.current_period_end)) {
      const endDate = new Date(subscription.current_period_end * 1000);
      if (!isNaN(endDate.getTime())) {
        periodEnd = endDate;
      }
    }

    const params = {
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      periodStart,
      periodEnd
    };

    if (planId) {
      params.planId = planId;
    }

    await databaseService.query(updateQuery, params);

    console.log(`✅ Subscription updated: ${subscription.id}${planId ? ` (Plan: ${planId})` : ''}`);
  } catch (error) {
    console.error('❌ Error handling customer.subscription.updated:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log(`Subscription deleted: ${subscription.id}`);

    // Update subscription status to cancelled
    await databaseService.query(`
      UPDATE tblSubscriptions SET
        status = @status,
        cancelled_at = GETDATE(),
        updated_at = GETDATE()
      WHERE stripe_subscription_id = @stripeSubscriptionId
    `, {
      stripeSubscriptionId: subscription.id,
      status: 'cancelled'
    });

    console.log(`✅ Subscription cancelled: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling customer.subscription.deleted:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    console.log(`\n💳 Invoice payment succeeded: ${invoice.id}`);
    console.log(`   Subscription ID: ${invoice.subscription}`);
    console.log(`   Amount: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);

    // Find subscription and organization
    const result = await databaseService.query(`
      SELECT organization_id, plan_id FROM tblSubscriptions
      WHERE stripe_subscription_id = @stripeSubscriptionId
    `, { stripeSubscriptionId: invoice.subscription });

    if (!result.recordset || result.recordset.length === 0) {
      console.log(`❌ Subscription not found for invoice ${invoice.id}`);
      return;
    }

    const { organization_id: organizationId, plan_id: planId } = result.recordset[0];
    console.log(`   Organization: ${organizationId}`);
    console.log(`   Plan: ${planId}`);

    // Allocate monthly credits
    const plan = StripeService.getPlanDetails(planId);
    if (!plan) {
      console.error(`   ❌ Plan not found: ${planId}`);
      return;
    }

    console.log(`   📊 Plan: ${plan.name}, ${plan.monthlyCredits} credits`);

    if (plan && plan.monthlyCredits > 0) {
      const usersResult = await databaseService.query(`
        SELECT id FROM tblUsers WHERE organization_id = @organizationId
      `, { organizationId });

      const users = usersResult.recordset || [];
      console.log(`   👥 Found ${users.length} users in organization`);

      for (const user of users) {
        console.log(`   💰 Allocating ${plan.monthlyCredits} credits to user ${user.id}...`);
        const creditResult = await CreditService.allocateCredits(
          user.id,
          plan.monthlyCredits,
          1,
          `Monthly allocation for ${plan.name} subscription`
        );

        if (creditResult.success) {
          console.log(`   ✅ Credits allocated to user ${user.id}`);
        } else {
          console.error(`   ❌ Failed to allocate credits to user ${user.id}: ${creditResult.error}`);
        }
      }
    } else {
      console.log(`   ℹ️  No credits to allocate (monthlyCredits: ${plan?.monthlyCredits})`);
    }

    // Create billing history record
    console.log(`   📝 Creating billing history record...`);
    try {
      const invoiceNumber = invoice.number || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Get subscription details for billing period
      const subscriptionResult = await databaseService.query(`
        SELECT id, current_period_start, current_period_end FROM tblSubscriptions
        WHERE stripe_subscription_id = @stripeSubscriptionId
      `, { stripeSubscriptionId: invoice.subscription });

      const subscription = subscriptionResult.recordset[0];

      await databaseService.query(`
        INSERT INTO tblBillingHistory (
          organization_id, subscription_id, invoice_number, amount_usd,
          tax_amount_usd, total_amount_usd, plan_name, plan_id,
          billing_period_start, billing_period_end, status, stripe_invoice_id
        ) VALUES (
          @organizationId, @subscriptionId, @invoiceNumber, @amountUsd,
          @taxAmount, @totalAmount, @planName, @planId,
          @periodStart, @periodEnd, @status, @stripeInvoiceId
        )
      `, {
        organizationId,
        subscriptionId: subscription.id,
        invoiceNumber,
        amountUsd: invoice.amount_paid / 100,
        taxAmount: (invoice.tax || 0) / 100,
        totalAmount: invoice.total / 100,
        planName: plan.name,
        planId,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        status: 'paid',
        stripeInvoiceId: invoice.id
      });

      console.log(`   ✅ Billing history record created: ${invoiceNumber}`);
    } catch (billingError) {
      console.error(`   ❌ Failed to create billing history record:`, billingError);
      // Don't throw - we still want to mark the webhook as processed
    }

    console.log(`✅ Credits allocated for invoice ${invoice.id}`);
  } catch (error) {
    console.error('❌ Error handling invoice.payment_succeeded:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log(`Invoice payment failed: ${invoice.id}`);

    // Update subscription status to past_due
    await databaseService.query(`
      UPDATE tblSubscriptions SET
        status = @status,
        updated_at = GETDATE()
      WHERE stripe_subscription_id = @stripeSubscriptionId
    `, {
      stripeSubscriptionId: invoice.subscription,
      status: 'past_due'
    });

    console.log(`✅ Subscription marked as past_due for invoice ${invoice.id}`);
  } catch (error) {
    console.error('Error handling invoice.payment_failed:', error);
    throw error;
  }
}

/**
 * Check if a webhook event has already been processed
 * @param {string} eventId - Stripe event ID
 * @returns {Promise<boolean>} - true if already processed, false otherwise
 */
async function checkWebhookEventProcessed(eventId) {
  try {
    const result = await databaseService.query(`
      SELECT id FROM tblWebhookEvents WHERE event_id = @eventId
    `, { eventId });

    return result.recordset && result.recordset.length > 0;
  } catch (error) {
    console.error('Error checking webhook event:', error);
    return false;
  }
}

/**
 * Record a webhook event as processed
 * @param {string} eventId - Stripe event ID
 * @param {string} eventType - Stripe event type
 * @param {string} organizationId - Organization ID
 */
async function recordWebhookEvent(eventId, eventType, organizationId) {
  try {
    await databaseService.query(`
      INSERT INTO tblWebhookEvents (event_id, event_type, organization_id)
      VALUES (@eventId, @eventType, @organizationId)
    `, { eventId, eventType, organizationId });

    console.log(`✅ Webhook event ${eventId} recorded for idempotency`);
  } catch (error) {
    // If it's a duplicate key error, that's fine - event was already recorded
    if (error.code === 'EREQUEST' && error.message.includes('Violation of PRIMARY KEY')) {
      console.log(`⚠️  Webhook event ${eventId} already recorded`);
    } else {
      console.error('Error recording webhook event:', error);
    }
  }
}

module.exports = router;

