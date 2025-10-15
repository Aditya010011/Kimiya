/**
 * Inbound Call Routes for Kimiya Voice AI
 * 
 * Main routing file for all inbound call functionality
 * Uses traditional TwiML approach (NOT ConversationRelay)
 */

const express = require('express');
const router = express.Router();

// Import handlers
const { 
  handleInboundCall, 
  handleUserInput, 
  handleCallStatus 
} = require('./inbound-twiml');

const {
  generateVoiceToken,
  handleOutgoingCall,
  createWebCallSession,
  getTwilioConfig,
  testTwilioConnection
} = require('./twilio-voice-token');

const inboundCallService = require('../services/InboundCallService');

// Initialize service
inboundCallService.initialize().catch(error => {
  console.error('❌ Failed to initialize Inbound Call Service:', error.message);
});

/**
 * TwiML Routes - Handle actual phone calls
 */

// Main inbound call webhook - receives calls from Twilio
router.post('/call', handleInboundCall);
router.get('/call', handleInboundCall); // Support GET for testing

// Handle user input (speech/DTMF) during calls
router.post('/input', handleUserInput);
router.get('/input', handleUserInput); // Support GET for testing

// Handle call status updates from Twilio
router.post('/status', handleCallStatus);

/**
 * Web-based Calling Routes - Twilio Voice SDK
 */

// Generate access token for web calling
router.post('/token', generateVoiceToken);
router.get('/token', generateVoiceToken); // Support GET for testing

// Handle outgoing calls from web client (redirects to inbound for testing)
router.post('/web-call', handleOutgoingCall);

// Create web call session for tracking
router.post('/web-session', createWebCallSession);

// Get Twilio configuration for frontend
router.get('/twilio-config', getTwilioConfig);

// Test Twilio connectivity
router.get('/test-connection', testTwilioConnection);

/**
 * Analytics and Management Routes
 */

// Get active calls
router.get('/active-calls', async (req, res) => {
  try {
    const activeCalls = inboundCallService.getActiveCalls();
    res.json({
      success: true,
      activeCalls: activeCalls,
      count: activeCalls.length
    });
  } catch (error) {
    console.error('❌ Failed to get active calls:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get active calls'
    });
  }
});

// Get call statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = inboundCallService.getCallStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Failed to get call stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get call statistics'
    });
  }
});

// Get call details by CallSid
router.get('/call/:callSid', async (req, res) => {
  try {
    const callSid = req.params.callSid;
    const callInfo = inboundCallService.getActiveCall(callSid);
    
    if (!callInfo) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    res.json({
      success: true,
      call: callInfo
    });
  } catch (error) {
    console.error('❌ Failed to get call details:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get call details'
    });
  }
});

// Manually end a call (for testing)
router.post('/call/:callSid/end', async (req, res) => {
  try {
    const callSid = req.params.callSid;
    const result = await inboundCallService.endCall(callSid, req.body);
    
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('❌ Failed to end call:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to end call'
    });
  }
});

/**
 * Database Management Routes
 */

// Get available workflows from database
router.get('/workflows', async (req, res) => {
  try {
    const databaseService = require('../services/database');
    const pool = await databaseService.getPool();

    const result = await pool.request()
      .query(`
        SELECT id, name, description, is_active, created_at, updated_at
        FROM tblWorkflows
        WHERE is_active = 1
        ORDER BY name ASC
      `);

    const workflows = result.recordset.map(workflow => ({
      id: workflow.id,
      workflowId: workflow.name, // Use name as workflowId for compatibility
      name: workflow.name,
      description: workflow.description || 'No description available',
      isActive: workflow.is_active,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at
    }));

    res.json({
      success: true,
      workflows: workflows,
      count: workflows.length
    });

  } catch (error) {
    console.error('❌ Failed to fetch workflows:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows',
      message: error.message
    });
  }
});

// Get call history from database
router.get('/history', async (req, res) => {
  try {
    const databaseService = require('../services/database');
    const pool = await databaseService.getPool();
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await pool.request()
      .input('limit', limit)
      .input('offset', offset)
      .query(`
        SELECT TOP (@limit) 
          ic.*,
          ica.completion_rate,
          ica.sentiment_score,
          ica.engagement_level,
          ica.call_outcome
        FROM tblInboundCalls ic
        LEFT JOIN tblInboundCallAnalytics ica ON ic.id = ica.call_id
        ORDER BY ic.created_at DESC
        OFFSET @offset ROWS
      `);

    res.json({
      success: true,
      calls: result.recordset,
      count: result.recordset.length
    });

  } catch (error) {
    console.error('❌ Failed to get call history:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get call history'
    });
  }
});

// Get call analytics
router.get('/analytics', async (req, res) => {
  try {
    const databaseService = require('../services/database');
    const pool = await databaseService.getPool();
    
    const days = parseInt(req.query.days) || 7;
    
    const result = await pool.request()
      .input('days', days)
      .query(`
        SELECT 
          COUNT(*) as total_calls,
          AVG(CAST(duration as FLOAT)) as avg_duration,
          AVG(ica.completion_rate) as avg_completion_rate,
          AVG(ica.sentiment_score) as avg_sentiment,
          COUNT(CASE WHEN ica.call_outcome = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN ica.call_outcome = 'abandoned' THEN 1 END) as abandoned_calls
        FROM tblInboundCalls ic
        LEFT JOIN tblInboundCallAnalytics ica ON ic.id = ica.call_id
        WHERE ic.created_at >= DATEADD(day, -@days, GETDATE())
      `);

    const analytics = result.recordset[0];
    
    res.json({
      success: true,
      analytics: {
        totalCalls: analytics.total_calls || 0,
        averageDuration: Math.round(analytics.avg_duration || 0),
        averageCompletionRate: Math.round((analytics.avg_completion_rate || 0) * 100) / 100,
        averageSentiment: Math.round((analytics.avg_sentiment || 0) * 100) / 100,
        completedCalls: analytics.completed_calls || 0,
        abandonedCalls: analytics.abandoned_calls || 0,
        successRate: analytics.total_calls > 0 
          ? Math.round(((analytics.completed_calls || 0) / analytics.total_calls) * 100)
          : 0
      },
      period: `${days} days`
    });

  } catch (error) {
    console.error('❌ Failed to get analytics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

/**
 * Health Check Route
 */
router.get('/health', async (req, res) => {
  try {
    const stats = inboundCallService.getCallStats();
    const isServiceInitialized = inboundCallService.isInitialized;
    
    res.json({
      success: true,
      status: 'healthy',
      service: {
        initialized: isServiceInitialized,
        activeCalls: stats.totalActiveCalls,
        averageStepsPerCall: Math.round(stats.averageStepsPerCall * 100) / 100,
        longestActiveCall: Math.round(stats.longestActiveCall)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('❌ Inbound routes error:', error.message);
  
  // If it's a TwiML request, return TwiML error
  if (req.path.includes('/call') || req.path.includes('/input')) {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">
        I'm sorry, there was a technical error. Please try calling back later.
    </Say>
    <Hangup/>
</Response>`);
  } else {
    // Return JSON error for API requests
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
