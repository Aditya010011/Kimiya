const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/user-analytics/:userId
 * Get comprehensive analytics data for a specific user
 * Users can access their own data, admins can access any user's data
 */
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Check authorization: users can only access their own data unless they're admin
    if (requestingUserRole !== 'admin' && parseInt(userId) !== requestingUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only access your own analytics data'
      });
    }

    console.log(`📊 GET /api/user-analytics/${userId} called by user ${requestingUserId}`);

    // Get user profile with last_login from sessions
    const userResult = await databaseService.query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        (SELECT TOP 1 us.created_at
         FROM tblUserSessions us
         WHERE us.user_id = u.id
         ORDER BY us.created_at DESC) as last_login
      FROM tblUsers u
      WHERE u.id = @userId
    `, { userId });

    if (!userResult.recordset || userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.recordset[0];

    // Get call statistics
    // Note: tblInboundCalls.workflow_id is a string, tblWorkflows.id is an int
    // We need to cast or match appropriately
    const callStatsResult = await databaseService.query(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN call_status = 'completed' THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN call_status = 'failed' THEN 1 ELSE 0 END) as failed_calls,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as avg_duration,
        SUM(CASE WHEN duration IS NOT NULL THEN duration ELSE 0 END) as total_duration
      FROM tblInboundCalls ic
      WHERE EXISTS (
        SELECT 1 FROM tblWorkflows w
        WHERE CAST(w.id AS NVARCHAR(255)) = ic.workflow_id
        AND w.created_by = @userId
      )
    `, { userId });

    const callStats = callStatsResult.recordset[0];

    // Get conversation/chat statistics
    const chatStatsResult = await databaseService.query(`
      SELECT 
        COUNT(*) as total_conversations,
        AVG(CASE WHEN duration IS NOT NULL THEN duration / 60.0 ELSE 0 END) as avg_conversation_length_minutes,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful_chats,
        SUM(CASE WHEN outcome = 'failure' OR outcome = 'abandoned' THEN 1 ELSE 0 END) as failed_chats
      FROM tblChatSessions
      WHERE user_id = @userId
    `, { userId });

    const chatStats = chatStatsResult.recordset[0];

    // Get workflow statistics
    const workflowStatsResult = await databaseService.query(`
      SELECT
        COUNT(*) as total_workflows,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_workflows,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_workflows
      FROM tblWorkflows
      WHERE created_by = @userId
    `, { userId });

    const workflowStats = workflowStatsResult.recordset[0];

    // Get workflow execution statistics
    const executionStatsResult = await databaseService.query(`
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failed_executions
      FROM tblChatSessions
      WHERE user_id = @userId AND workflow_id IS NOT NULL
    `, { userId });

    const executionStats = executionStatsResult.recordset[0];

    // Get cost/credit usage
    const costStatsResult = await databaseService.query(`
      SELECT
        SUM(CASE WHEN type = 'debit' THEN ABS(amount) ELSE 0 END) as total_credits_used,
        SUM(CASE WHEN type = 'credit' OR type = 'allocation' THEN amount ELSE 0 END) as total_credits_added
      FROM tblCreditTransactions
      WHERE user_id = @userId
        AND created_at >= DATEADD(MONTH, -1, GETDATE())
    `, { userId });

    const costStats = costStatsResult.recordset[0];

    // Calculate success rates
    const callSuccessRate = callStats.total_calls > 0 
      ? (callStats.successful_calls / callStats.total_calls) * 100 
      : 0;

    const workflowSuccessRate = executionStats.total_executions > 0
      ? (executionStats.successful_executions / executionStats.total_executions) * 100
      : 0;

    // Build response
    const analyticsData = {
      user_profile: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      },
      twilio_metrics: {
        total_calls_made: callStats.total_calls || 0,
        successful_calls: callStats.successful_calls || 0,
        failed_calls: callStats.failed_calls || 0,
        average_call_duration: Math.round(callStats.avg_duration || 0),
        total_call_duration: callStats.total_duration || 0,
        success_rate: Math.round(callSuccessRate * 10) / 10
      },
      conversation_analytics: {
        total_conversations: chatStats.total_conversations || 0,
        average_conversation_length: Math.round((chatStats.avg_conversation_length_minutes || 0) * 10) / 10,
        successful_conversations: chatStats.successful_chats || 0,
        failed_conversations: chatStats.failed_chats || 0
      },
      workflow_activity: {
        created_workflows: workflowStats.total_workflows || 0,
        active_workflows: workflowStats.active_workflows || 0,
        inactive_workflows: workflowStats.inactive_workflows || 0,
        total_executions: executionStats.total_executions || 0,
        successful_executions: executionStats.successful_executions || 0,
        failed_executions: executionStats.failed_executions || 0,
        success_rate: Math.round(workflowSuccessRate * 10) / 10
      },
      cost_metrics: {
        total_credits_used: costStats.total_credits_used || 0,
        total_credits_added: costStats.total_credits_added || 0,
        // Assuming 1 credit = $0.01 for cost calculation
        estimated_monthly_cost: ((costStats.total_credits_used || 0) * 0.01).toFixed(2)
      },
      last_updated: new Date().toISOString()
    };

    console.log('✅ User analytics retrieved for user:', userId);

    res.json({
      success: true,
      data: analyticsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user analytics',
      message: error.message
    });
  }
});

module.exports = router;

