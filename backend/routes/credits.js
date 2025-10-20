const express = require('express');
const router = express.Router();
const CreditService = require('../services/CreditService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Input validation middleware
 */
const validateCreditDeduction = (req, res, next) => {
  const { amount, serviceType } = req.body;
  
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount. Must be a positive number.'
    });
  }
  
  const validServiceTypes = ['chat', 'inbound_call', 'outbound_call', 'storage', 'transcription', 'ai_service'];
  if (!serviceType || !validServiceTypes.includes(serviceType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid service type. Must be one of: ${validServiceTypes.join(', ')}`
    });
  }
  
  next();
};

const validateCreditAllocation = (req, res, next) => {
  const { userId, amount } = req.body;
  
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid userId. Must be a positive number.'
    });
  }
  
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount. Must be a positive number.'
    });
  }
  
  next();
};

/**
 * GET /api/credits/balance/:userId
 * Get user's current credit balance
 */
router.get('/balance/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    // Users can only access their own balance, admins can access any user's balance
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own credit balance.'
      });
    }
    
    const result = await CreditService.getUserCreditBalance(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/credits/balance/:userId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/credits/deduct
 * Deduct credits from user's balance
 * Body: { amount, serviceType, serviceDetails?, referenceId?, referenceType? }
 */
router.post('/deduct', authenticateToken, validateCreditDeduction, async (req, res) => {
  try {
    const { amount, serviceType, serviceDetails = {}, referenceId = null, referenceType = null } = req.body;
    const userId = req.user.id;
    
    console.log(`Credit deduction request: User ${userId}, Amount: ${amount}, Service: ${serviceType}`);
    
    const result = await CreditService.deductCredits(
      userId, 
      amount, 
      serviceType, 
      serviceDetails, 
      referenceId, 
      referenceType
    );
    
    if (result.success) {
      console.log(`Credit deduction successful: ${JSON.stringify(result.data)}`);
      res.json(result);
    } else {
      console.log(`Credit deduction failed: ${result.error}`);
      
      // Return appropriate status code based on error type
      if (result.error === 'Insufficient credits') {
        res.status(402).json(result); // 402 Payment Required
      } else if (result.error === 'Credit balance not found') {
        res.status(404).json(result);
      } else {
        res.status(500).json(result);
      }
    }
    
  } catch (error) {
    console.error('Error in POST /api/credits/deduct:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/credits/transactions/:userId
 * Get user's credit transaction history
 * Query params: limit (default: 50), offset (default: 0)
 */
router.get('/transactions/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
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
    
    // Users can only access their own transactions, admins can access any user's transactions
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own transaction history.'
      });
    }
    
    const result = await CreditService.getUserTransactionHistory(userId, limit, offset);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/credits/transactions/:userId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/credits/allocate
 * Allocate credits to a user (Admin only)
 * Body: { userId, amount, notes? }
 */
router.post('/admin/allocate', authenticateToken, requireAdmin, validateCreditAllocation, async (req, res) => {
  try {
    const { userId, amount, notes = null } = req.body;
    const adminUserId = req.user.id;
    
    console.log(`Credit allocation request: Admin ${adminUserId} allocating ${amount} credits to User ${userId}`);
    
    const result = await CreditService.allocateCredits(userId, amount, adminUserId, notes);
    
    if (result.success) {
      console.log(`Credit allocation successful: ${JSON.stringify(result.data)}`);
      res.json(result);
    } else {
      console.log(`Credit allocation failed: ${result.error}`);
      
      if (result.error === 'User credit balance not found') {
        res.status(404).json(result);
      } else {
        res.status(500).json(result);
      }
    }
    
  } catch (error) {
    console.error('Error in POST /api/admin/credits/allocate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/credits/balance (current user)
 * Get current user's credit balance
 */
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await CreditService.getUserCreditBalance(userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/credits/balance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/credits/transactions (current user)
 * Get current user's credit transaction history
 * Query params: limit (default: 50), offset (default: 0)
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
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
    
    const result = await CreditService.getUserTransactionHistory(userId, limit, offset);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error in GET /api/credits/transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
