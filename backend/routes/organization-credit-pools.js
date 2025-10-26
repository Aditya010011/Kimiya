const express = require('express');
const router = express.Router();
const OrganizationCreditPoolService = require('../services/OrganizationCreditPoolService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/organization-credit-pools/:organizationId
 * Get organization credit pool information
 */
router.get('/:organizationId', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    // Verify user belongs to organization or is admin
    if (req.user.role !== 'admin' && req.user.organization_id !== organizationId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const result = await OrganizationCreditPoolService.getOrganizationPool(organizationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('Error getting organization pool:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/organization-credit-pools/:organizationId/initialize
 * Initialize organization credit pool (Admin only)
 */
router.post('/:organizationId/initialize', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { initialCredits = 0 } = req.body;
    
    if (typeof initialCredits !== 'number' || initialCredits < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid initialCredits. Must be a non-negative number.'
      });
    }
    
    const result = await OrganizationCreditPoolService.initializeOrganizationPool(
      organizationId,
      initialCredits
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error initializing organization pool:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/organization-credit-pools/:organizationId/allocate
 * Allocate credits to organization pool (Admin only)
 */
router.post('/:organizationId/allocate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { amount, notes = null } = req.body;
    const adminUserId = req.user.id;
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number.'
      });
    }
    
    const result = await OrganizationCreditPoolService.allocateToPool(
      organizationId,
      amount,
      adminUserId,
      notes
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error allocating to pool:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/organization-credit-pools/:organizationId/transfer
 * Transfer credits between users in organization
 */
router.post('/:organizationId/transfer', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { fromUserId, toUserId, amount, reason = null } = req.body;
    
    // Verify user is admin or is the source user
    if (req.user.role !== 'admin' && req.user.id !== fromUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only transfer from your own account.'
      });
    }
    
    // Validate input
    if (!fromUserId || typeof fromUserId !== 'number' || fromUserId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fromUserId'
      });
    }
    
    if (!toUserId || typeof toUserId !== 'number' || toUserId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid toUserId'
      });
    }
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number.'
      });
    }
    
    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot transfer credits to the same user'
      });
    }
    
    const result = await OrganizationCreditPoolService.transferCredits(
      organizationId,
      fromUserId,
      toUserId,
      amount,
      reason
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error transferring credits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

