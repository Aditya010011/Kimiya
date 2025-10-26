const express = require('express');
const router = express.Router();
const CreditResetService = require('../services/CreditResetService');
const CreditService = require('../services/CreditService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * POST /api/admin/credits/allocate
 * Allocate credits to a user (Admin only)
 * Body: { userId, amount, notes? }
 */
router.post('/allocate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, notes = null } = req.body;
    const adminUserId = req.user.id;

    // Validate input
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

    console.log(`Credit allocation request: Admin ${adminUserId} allocating ${amount} credits to User ${userId}`);

    const result = await CreditService.allocateCredits(userId, amount, adminUserId, notes);

    if (result.success) {
      console.log(`Credit allocation successful: ${JSON.stringify(result.data)}`);

      // ✅ FIX: Return updated balances for both recipient and admin
      // This allows frontend to update UI without refresh
      const recipientBalance = await CreditService.getUserCreditBalance(userId);
      const adminBalance = await CreditService.getUserCreditBalance(adminUserId);

      res.json({
        ...result,
        data: {
          ...result.data,
          recipientBalance: recipientBalance.success ? recipientBalance.data : null,
          adminBalance: adminBalance.success ? adminBalance.data : null
        }
      });
    } else {
      console.log(`Credit allocation failed: ${result.error}`);

      if (result.error === 'User credit balance not found' || result.error === 'Admin credit balance not found') {
        res.status(404).json(result);
      } else if (result.error.includes('does not have enough credits')) {
        res.status(400).json(result);
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

/**
 * GET /api/admin/credits/overview
 * Get comprehensive admin credit overview with usage breakdown
 */
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const databaseService = require('../services/database');

    // Get total users and credits
    const overallStats = await databaseService.query(`
      SELECT
        COUNT(DISTINCT cb.user_id) as total_users,
        SUM(cb.allocated_credits) as total_credits_allocated,
        SUM(cb.used_credits) as total_credits_used,
        SUM(cb.current_balance) as total_credits_remaining,
        COUNT(CASE WHEN cb.current_balance < cb.monthly_allocation * 0.1 THEN 1 END) as users_with_low_balance,
        COUNT(CASE WHEN cb.monthly_used > cb.monthly_allocation * 0.8 THEN 1 END) as users_with_high_usage
      FROM tblCreditBalances cb
    `);

    // Get top users by usage
    const topUsers = await databaseService.query(`
      SELECT TOP 10
        cb.user_id,
        u.email as user_email,
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as user_name,
        ISNULL(cb.used_credits, 0) as credits_used,
        CAST(
          CASE
            WHEN (SELECT SUM(used_credits) FROM tblCreditBalances) > 0
            THEN CAST(ISNULL(cb.used_credits, 0) AS FLOAT) / (SELECT SUM(used_credits) FROM tblCreditBalances) * 100
            ELSE 0
          END
          AS DECIMAL(5,2)
        ) as percentage_of_total
      FROM tblCreditBalances cb
      INNER JOIN tblUsers u ON cb.user_id = u.id
      WHERE cb.used_credits > 0
      ORDER BY cb.used_credits DESC
    `);

    // Get usage by service type
    const usageByService = await databaseService.query(`
      SELECT
        service_type,
        SUM(CAST(amount AS BIGINT)) as total_credits
      FROM tblCreditTransactions
      WHERE type = 'debit'
      GROUP BY service_type
    `);

    // Get recent allocations
    const recentAllocations = await databaseService.query(`
      SELECT TOP 10
        ct.id,
        ct.user_id,
        u.email as user_email,
        u.first_name + ' ' + u.last_name as user_name,
        ct.amount,
        ct.type,
        ct.created_at,
        ct.notes
      FROM tblCreditTransactions ct
      INNER JOIN tblUsers u ON ct.user_id = u.id
      WHERE ct.type = 'allocation'
      ORDER BY ct.created_at DESC
    `);

    // Convert usage by service to object
    const usageByServiceObj = {};
    usageByService.recordset.forEach(row => {
      usageByServiceObj[row.service_type || 'unknown'] = row.total_credits || 0;
    });

    const stats = overallStats.recordset[0];

    res.json({
      success: true,
      data: {
        total_users: stats.total_users || 0,
        total_credits_allocated: stats.total_credits_allocated || 0,
        total_credits_used: stats.total_credits_used || 0,
        total_credits_remaining: stats.total_credits_remaining || 0,
        users_with_low_balance: stats.users_with_low_balance || 0,
        users_with_high_usage: stats.users_with_high_usage || 0,
        top_users_by_usage: topUsers.recordset || [],
        usage_by_service: usageByServiceObj,
        recent_allocations: (recentAllocations.recordset || []).map(row => ({
          id: row.id,
          user_id: row.user_id,
          user_email: row.user_email,
          user_name: row.user_name,
          amount: row.amount,
          allocation_type: row.type,
          created_at: row.created_at,
          notes: row.notes
        }))
      }
    });

  } catch (error) {
    console.error('Error getting admin credit overview:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

