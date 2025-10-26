const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const BillingService = require('../services/BillingService');

/**
 * GET /api/billing/organization/:organizationId
 * Get organization billing information including subscription, payment methods, and billing history
 */
router.get('/organization/:organizationId', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;

    console.log(`📊 GET /api/billing/organization/${organizationId} called`);

    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      console.log(`❌ Access denied for user ${req.user.id} to org ${organizationId}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own organization billing.'
      });
    }

    const result = await BillingService.getOrganizationBilling(organizationId);

    if (result.success) {
      console.log(`✅ Billing data retrieved successfully for org ${organizationId}`);
      if (result.data && result.data.current_subscription) {
        console.log(`   Current plan_id: ${result.data.current_subscription.plan_id}`);
        console.log(`   Current plan name: ${result.data.current_subscription.plan.name}`);
        console.log(`   Subscription status: ${result.data.current_subscription.status}`);
        console.log(`   Updated at: ${result.data.current_subscription.updated_at}`);
      } else {
        console.log(`   ⚠️ No subscription found for org ${organizationId}`);
      }
      res.json(result);
    } else {
      console.log(`❌ Error retrieving billing data: ${result.error}`);
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/billing/organization/:organizationId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/subscribe
 * Create or update subscription for an organization
 * Body: { organizationId, planId, paymentMethodId?, billingAddress?, billingCycle? }
 */
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { organizationId, planId, paymentMethodId, billingAddress, billingCycle = 'monthly' } = req.body;

    // Validate required fields
    if (!organizationId || !planId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID and Plan ID are required'
      });
    }

    // Validate billing cycle
    if (billingCycle && !['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        error: 'Billing cycle must be either "monthly" or "annual"'
      });
    }

    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only manage your own organization subscription.'
      });
    }

    const result = await BillingService.createOrUpdateSubscription(
      organizationId,
      planId,
      paymentMethodId,
      billingAddress,
      req.user.id,
      billingCycle
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error in POST /api/billing/subscribe:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/cancel
 * Cancel subscription for an organization
 * Body: { organizationId, cancelAtPeriodEnd? }
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const { organizationId, cancelAtPeriodEnd = true } = req.body;
    
    // Validate required fields
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }
    
    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only manage your own organization subscription.'
      });
    }
    
    const result = await BillingService.cancelSubscription(organizationId, cancelAtPeriodEnd, req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error in POST /api/billing/cancel:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/payment-methods
 * Add payment method for an organization
 * Body: { organizationId, type, last_four, brand, exp_month, exp_year, is_default?, stripe_payment_method_id? }
 */
router.post('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { organizationId, type, last_four, brand, exp_month, exp_year, is_default, stripe_payment_method_id } = req.body;
    
    // Validate required fields
    if (!organizationId || !type || !last_four || !brand || !exp_month || !exp_year) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID, type, last_four, brand, exp_month, and exp_year are required'
      });
    }
    
    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only manage your own organization payment methods.'
      });
    }
    
    const paymentMethodData = {
      type,
      last_four,
      brand,
      exp_month,
      exp_year,
      is_default: is_default || false,
      stripe_payment_method_id
    };
    
    const result = await BillingService.addPaymentMethod(organizationId, paymentMethodData, req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error in POST /api/billing/payment-methods:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/payment-methods/:organizationId
 * Get payment methods for an organization
 */
router.get('/payment-methods/:organizationId', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own organization payment methods.'
      });
    }
    
    const result = await BillingService.getPaymentMethods(organizationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/billing/payment-methods/:organizationId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/billing/payment-methods/:paymentMethodId
 * Remove payment method
 */
router.delete('/payment-methods/:paymentMethodId', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    
    const result = await BillingService.removePaymentMethod(paymentMethodId, req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error in DELETE /api/billing/payment-methods/:paymentMethodId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/history/:organizationId
 * Get billing history for an organization
 * Query params: limit (default: 50), offset (default: 0)
 */
router.get('/history/:organizationId', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own organization billing history.'
      });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }
    
    if (offset < 0) {
      return res.status(400).json({
        success: false,
        error: 'Offset must be non-negative'
      });
    }
    
    const result = await BillingService.getBillingHistory(organizationId, limit, offset);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/billing/history/:organizationId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/change-plan
 * Change subscription plan
 * Body: { organizationId, newPlanId, effectiveDate?, billingCycle? }
 */
router.post('/change-plan', authenticateToken, async (req, res) => {
  try {
    const { organizationId, newPlanId, effectiveDate = 'immediate', billingCycle = 'monthly' } = req.body;

    // Validate required fields
    if (!organizationId || !newPlanId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID and new Plan ID are required'
      });
    }

    // Check if user has access to this organization
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only manage your own organization subscription.'
      });
    }

    const result = await BillingService.changePlan(organizationId, newPlanId, effectiveDate, billingCycle, req.user.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error in POST /api/billing/change-plan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
