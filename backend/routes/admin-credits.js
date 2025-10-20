const express = require('express');
const router = express.Router();
const CreditResetService = require('../services/CreditResetService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/admin/credits/upcoming-resets
 * Get information about upcoming credit resets
 */
router.get('/upcoming-resets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await CreditResetService.getUpcomingResets();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error getting upcoming resets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/credits/manual-reset/:userId
 * Manually trigger credit reset for a specific user
 */
router.post('/manual-reset/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminUserId = req.user.id;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    console.log(`Admin ${adminUserId} triggering manual credit reset for user ${userId}`);
    
    const result = await CreditResetService.manualResetForUser(userId, adminUserId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error in manual reset:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/credits/run-reset-job
 * Manually trigger the monthly credit reset job (for testing)
 */
router.post('/run-reset-job', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log(`Admin ${req.user.id} manually triggering credit reset job`);
    
    const result = await CreditResetService.resetMonthlyCredits();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error running reset job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/credits/cleanup-expired
 * Manually trigger expired credits cleanup
 */
router.post('/cleanup-expired', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log(`Admin ${req.user.id} manually triggering expired credits cleanup`);
    
    const result = await CreditResetService.cleanupExpiredCredits();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error cleaning up expired credits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/credits/plan-change-history/:organizationId
 * Get plan change history for an organization
 */
router.get('/plan-change-history/:organizationId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const databaseService = require('../services/database');
    
    const result = await databaseService.query(`
      SELECT 
        pch.*,
        op.name as old_plan_name,
        np.name as new_plan_name,
        u.email as changed_by_email,
        u.first_name + ' ' + u.last_name as changed_by_name
      FROM tblPlanChangeHistory pch
      INNER JOIN tblCreditPlans op ON pch.old_plan_id = op.id
      INNER JOIN tblCreditPlans np ON pch.new_plan_id = np.id
      INNER JOIN tblUsers u ON pch.changed_by = u.id
      WHERE pch.organization_id = @organizationId
      ORDER BY pch.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { organizationId, limit, offset });
    
    // Get total count
    const countResult = await databaseService.query(`
      SELECT COUNT(*) as total
      FROM tblPlanChangeHistory
      WHERE organization_id = @organizationId
    `, { organizationId });
    
    res.json({
      success: true,
      data: {
        history: result.recordset,
        total: countResult.recordset[0].total,
        limit,
        offset
      }
    });
    
  } catch (error) {
    console.error('Error getting plan change history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/credits/statistics
 * Get overall credit system statistics
 */
router.get('/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const databaseService = require('../services/database');
    
    // Get various statistics
    const stats = await databaseService.query(`
      SELECT 
        (SELECT COUNT(*) FROM tblCreditBalances) as total_users,
        (SELECT SUM(current_balance) FROM tblCreditBalances) as total_credits,
        (SELECT SUM(used_credits) FROM tblCreditBalances) as total_used,
        (SELECT SUM(allocated_credits) FROM tblCreditBalances) as total_allocated,
        (SELECT COUNT(*) FROM tblCreditBalances WHERE current_balance < monthly_allocation * 0.1) as low_balance_users,
        (SELECT COUNT(*) FROM tblCreditBalances WHERE current_balance <= 0) as zero_balance_users,
        (SELECT COUNT(*) FROM tblCreditTransactions WHERE created_at >= DATEADD(day, -30, GETDATE())) as transactions_last_30_days,
        (SELECT COUNT(*) FROM tblPlanChangeHistory WHERE created_at >= DATEADD(day, -30, GETDATE())) as plan_changes_last_30_days
    `);
    
    // Get credits by plan
    const byPlan = await databaseService.query(`
      SELECT 
        cp.name as plan_name,
        COUNT(DISTINCT cb.user_id) as user_count,
        SUM(cb.current_balance) as total_balance,
        SUM(cb.used_credits) as total_used,
        AVG(cb.current_balance) as avg_balance
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      INNER JOIN tblSubscriptions s ON u.organization_id = s.organization_id
      INNER JOIN tblCreditPlans cp ON s.plan_id = cp.id
      WHERE s.status = 'active'
      GROUP BY cp.name
      ORDER BY user_count DESC
    `);
    
    res.json({
      success: true,
      data: {
        overall: stats.recordset[0],
        byPlan: byPlan.recordset
      }
    });
    
  } catch (error) {
    console.error('Error getting credit statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

