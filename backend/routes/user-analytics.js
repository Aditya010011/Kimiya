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

/**
 * GET /api/user-analytics/:userId/call-records
 * Get detailed call records for a specific user
 */
router.get('/:userId/call-records', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    // Check authorization
    if (requestingUserRole !== 'admin' && parseInt(userId) !== requestingUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only access your own call records'
      });
    }

    console.log(`📞 GET /api/user-analytics/${userId}/call-records called by user role: ${requestingUserRole}`);

    // Get call records
    // For admin users: return all calls
    // For regular users: return calls for workflows they created
    let callRecordsResult;

    if (requestingUserRole === 'admin') {
      console.log(`📊 Admin user - fetching all call records`);
      callRecordsResult = await databaseService.query(`
        SELECT
          ic.id as call_id,
          ic.call_sid,
          ic.from_number,
          ic.to_number,
          ic.workflow_id,
          ic.workflow_name,
          ic.call_status as status,
          ic.call_direction as direction,
          ic.start_time,
          ic.end_time,
          ic.duration,
          ic.recording_url,
          ic.recording_duration,
          ic.transcription,
          ic.summary,
          ic.cost,
          ic.total_prompt_tokens,
          ic.total_completion_tokens,
          ic.total_tokens,
          ica.sentiment_score,
          ica.key_topics,
          ica.action_items,
          ica.call_outcome,
          ica.customer_satisfaction,
          ica.agent_performance
        FROM tblInboundCalls ic
        LEFT JOIN tblInboundCallAnalytics ica ON ic.id = ica.call_id
        ORDER BY ic.start_time DESC
      `);
    } else {
      console.log(`📊 Regular user - fetching calls for user's workflows`);
      callRecordsResult = await databaseService.query(`
        SELECT
          ic.id as call_id,
          ic.call_sid,
          ic.from_number,
          ic.to_number,
          ic.workflow_id,
          ic.workflow_name,
          ic.call_status as status,
          ic.call_direction as direction,
          ic.start_time,
          ic.end_time,
          ic.duration,
          ic.recording_url,
          ic.recording_duration,
          ic.transcription,
          ic.summary,
          ic.cost,
          ic.total_prompt_tokens,
          ic.total_completion_tokens,
          ic.total_tokens,
          ica.sentiment_score,
          ica.key_topics,
          ica.action_items,
          ica.call_outcome,
          ica.customer_satisfaction,
          ica.agent_performance
        FROM tblInboundCalls ic
        LEFT JOIN tblInboundCallAnalytics ica ON ic.id = ica.call_id
        WHERE EXISTS (
          SELECT 1 FROM tblWorkflows w
          WHERE CAST(w.id AS NVARCHAR(255)) = ic.workflow_id
          AND w.created_by = @userId
        )
        ORDER BY ic.start_time DESC
      `, { userId });
    }

    // Transform the data to match the CallRecord interface
    const callRecords = callRecordsResult.recordset.map(record => ({
      call_id: record.call_id.toString(),
      call_sid: record.call_sid,
      user_id: parseInt(userId),
      workflow_id: record.workflow_id,
      workflow_name: record.workflow_name,
      direction: record.direction,
      from_number: record.from_number,
      to_number: record.to_number,
      status: record.status,
      start_time: record.start_time,
      end_time: record.end_time,
      duration: record.duration || 0,
      recording_url: record.recording_url,
      recording_duration: record.recording_duration,
      transcription: record.transcription,
      summary: record.summary,
      cost: record.cost || 0,
      total_prompt_tokens: record.total_prompt_tokens,
      total_completion_tokens: record.total_completion_tokens,
      total_tokens: record.total_tokens,
      metadata: {},
      analysis: record.sentiment_score ? {
        sentiment_score: record.sentiment_score,
        key_topics: record.key_topics ? JSON.parse(record.key_topics) : [],
        action_items: record.action_items ? JSON.parse(record.action_items) : [],
        outcome: record.call_outcome || 'unsuccessful',
        customer_satisfaction: record.customer_satisfaction,
        agent_performance: record.agent_performance
      } : undefined
    }));

    // Calculate call analytics
    const totalCalls = callRecords.length;
    const answeredCalls = callRecords.filter(c => c.status === 'answered' || c.status === 'completed').length;
    const missedCalls = callRecords.filter(c => c.status === 'no-answer' || c.status === 'declined').length;
    const totalDuration = callRecords.reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;
    const totalCost = callRecords.reduce((sum, c) => sum + (c.cost || 0), 0);

    const callAnalytics = {
      total_calls: totalCalls,
      answered_calls: answeredCalls,
      missed_calls: missedCalls,
      total_duration: totalDuration,
      average_duration: Math.round(avgDuration),
      answer_rate: Math.round(answerRate * 10) / 10,
      cost_summary: {
        total_cost: totalCost,
        average_cost_per_call: totalCalls > 0 ? totalCost / totalCalls : 0,
        cost_by_direction: {
          inbound: callRecords.filter(c => c.direction === 'inbound').reduce((sum, c) => sum + (c.cost || 0), 0),
          outbound: callRecords.filter(c => c.direction === 'outbound').reduce((sum, c) => sum + (c.cost || 0), 0)
        }
      }
    };

    console.log(`✅ Retrieved ${callRecords.length} call records for user ${userId}`);

    res.json({
      success: true,
      data: {
        call_records: callRecords,
        call_analytics: callAnalytics
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get call records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve call records',
      message: error.message
    });
  }
});

module.exports = router;

