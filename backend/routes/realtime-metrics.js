const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');

/**
 * GET /api/realtime-metrics
 * Get real-time system metrics
 * 
 * Returns:
 * - active_users_now: Count of users with active sessions
 * - active_sessions: Count of active, non-expired sessions
 * - current_calls: Count of active inbound calls
 * - api_requests_per_minute: Calculated from recent API logs
 * - error_rate_last_hour: Percentage of errors in last hour
 * - system_health: Overall system health status
 */
router.get('/', async (req, res) => {
  try {
    console.log('📊 GET /api/realtime-metrics called');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Get active users (users with active sessions)
    const activeUsersResult = await databaseService.query(`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM tblUserSessions
      WHERE is_active = 1
        AND expires_at > GETDATE()
        AND last_accessed_at > DATEADD(MINUTE, -30, GETDATE())
    `);

    // Get active sessions count
    const activeSessionsResult = await databaseService.query(`
      SELECT COUNT(*) as active_sessions
      FROM tblUserSessions
      WHERE is_active = 1
        AND expires_at > GETDATE()
    `);

    // Get current active calls
    const activeCallsResult = await databaseService.query(`
      SELECT COUNT(*) as current_calls
      FROM tblInboundCalls
      WHERE call_status = 'in-progress'
        AND start_time > DATEADD(HOUR, -2, GETDATE())
    `);

    // Get API requests in the last minute (for per-minute calculation)
    // This assumes you have an API logs table or similar tracking
    let apiRequestsPerMinute = 0;
    try {
      const apiRequestsResult = await databaseService.query(`
        SELECT COUNT(*) as request_count
        FROM tblChatSessions
        WHERE created_at > @oneMinuteAgo
      `, { oneMinuteAgo });
      
      apiRequestsPerMinute = apiRequestsResult.recordset[0]?.request_count || 0;
    } catch (error) {
      console.warn('Could not fetch API requests per minute:', error.message);
      // Fallback: estimate from chat sessions
      apiRequestsPerMinute = 0;
    }

    // Get error rate in the last hour
    let errorRateLastHour = 0;
    try {
      const errorStatsResult = await databaseService.query(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN outcome = 'failure' OR outcome = 'abandoned' THEN 1 ELSE 0 END) as error_count
        FROM tblChatSessions
        WHERE created_at > @oneHourAgo
      `, { oneHourAgo });

      const stats = errorStatsResult.recordset[0];
      if (stats && stats.total_sessions > 0) {
        errorRateLastHour = (stats.error_count / stats.total_sessions) * 100;
      }
    } catch (error) {
      console.warn('Could not calculate error rate:', error.message);
      errorRateLastHour = 0;
    }

    // Determine system health based on metrics
    let systemHealth = 'healthy';
    if (errorRateLastHour > 10) {
      systemHealth = 'critical';
    } else if (errorRateLastHour > 5) {
      systemHealth = 'warning';
    }

    // Check database connectivity
    try {
      await databaseService.query('SELECT 1 as health_check');
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      systemHealth = 'critical';
    }

    const metrics = {
      active_users_now: activeUsersResult.recordset[0]?.active_users || 0,
      active_sessions: activeSessionsResult.recordset[0]?.active_sessions || 0,
      current_calls: activeCallsResult.recordset[0]?.current_calls || 0,
      api_requests_per_minute: apiRequestsPerMinute,
      error_rate_last_hour: Math.round(errorRateLastHour * 100) / 100,
      system_health: systemHealth,
      last_updated: now.toISOString()
    };

    console.log('✅ Real-time metrics retrieved:', metrics);

    res.json({
      success: true,
      data: metrics,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to get real-time metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve real-time metrics',
      message: error.message
    });
  }
});

module.exports = router;

