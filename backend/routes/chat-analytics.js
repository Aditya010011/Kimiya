const express = require('express');
const router = express.Router();
const ChatAnalyticsRepository = require('../repositories/ChatAnalyticsRepository');
const databaseService = require('../services/database');

// Initialize services
const chatAnalyticsRepo = new ChatAnalyticsRepository(databaseService);

/**
 * Create a new chat session
 * POST /api/chat-analytics/sessions
 */
router.post('/sessions', async (req, res) => {
  console.log('=== CREATE CHAT SESSION API CALLED ===');
  console.log('Request body:', req.body);

  try {
    const { session_id, workflow_id, workflow_name, user_id, start_time } = req.body;

    // Validation
    if (!session_id || !workflow_name || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: session_id, workflow_name, user_id'
      });
    }

    const sessionData = {
      session_id,
      workflow_id,
      workflow_name,
      user_id,
      start_time: start_time ? new Date(start_time) : new Date()
    };

    const result = await chatAnalyticsRepo.createChatSession(sessionData);

    console.log('Chat session created successfully:', result);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error creating chat session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat session',
      details: error.message
    });
  }
});

/**
 * Update a chat session (end session, set outcome, etc.)
 * PUT /api/chat-analytics/sessions/:sessionId
 */
router.put('/sessions/:sessionId', async (req, res) => {
  console.log('=== UPDATE CHAT SESSION API CALLED ===');
  console.log('Session ID:', req.params.sessionId);
  console.log('Request body:', req.body);

  try {
    const { sessionId } = req.params;
    const updateData = req.body;

    // Convert string dates to Date objects if provided
    if (updateData.end_time) {
      updateData.end_time = new Date(updateData.end_time);
    }

    const result = await chatAnalyticsRepo.updateChatSession(sessionId, updateData);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    console.log('Chat session updated successfully:', result);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating chat session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update chat session',
      details: error.message
    });
  }
});

/**
 * Add a message to a chat session
 * POST /api/chat-analytics/sessions/:sessionId/messages
 */
router.post('/sessions/:sessionId/messages', async (req, res) => {
  console.log('=== ADD CHAT MESSAGE API CALLED ===');
  console.log('Session ID:', req.params.sessionId);
  console.log('Request body:', req.body);

  try {
    const { sessionId } = req.params;
    const { message_id, type, content, timestamp, node_id, node_name, metadata } = req.body;

    // Validation
    if (!message_id || !type || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message_id, type, content'
      });
    }

    if (!['user', 'ai', 'system'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message type. Must be: user, ai, or system'
      });
    }

    const messageData = {
      message_id,
      session_id: sessionId,
      type,
      content,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      node_id,
      node_name,
      // Extract metadata fields
      confidence_score: metadata?.confidence_score,
      processing_time: metadata?.processing_time,
      tokens_used: metadata?.tokens_used,
      intent_detected: metadata?.intent_detected,
      entities_extracted: metadata?.entities_extracted
    };

    const result = await chatAnalyticsRepo.addChatMessage(messageData);

    console.log('Chat message added successfully:', result);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error adding chat message:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to add chat message',
      details: error.message
    });
  }
});

/**
 * Create or update conversation analysis
 * POST /api/chat-analytics/sessions/:sessionId/analysis
 */
router.post('/sessions/:sessionId/analysis', async (req, res) => {
  console.log('=== UPSERT CONVERSATION ANALYSIS API CALLED ===');
  console.log('Session ID:', req.params.sessionId);
  console.log('Request body:', req.body);

  try {
    const { sessionId } = req.params;
    const analysisData = req.body;

    // Validation for engagement level
    if (analysisData.engagement_level && !['low', 'medium', 'high'].includes(analysisData.engagement_level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid engagement_level. Must be: low, medium, or high'
      });
    }

    const result = await chatAnalyticsRepo.upsertConversationAnalysis(sessionId, analysisData);

    console.log('Conversation analysis updated successfully:', result);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating conversation analysis:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation analysis',
      details: error.message
    });
  }
});

/**
 * Get chat sessions with filtering
 * GET /api/chat-analytics/sessions
 */
router.get('/sessions', async (req, res) => {
  console.log('=== GET CHAT SESSIONS API CALLED ===');
  console.log('Query params:', req.query);

  try {
    const filters = {};

    // Parse query parameters
    if (req.query.user_id) filters.user_id = parseInt(req.query.user_id);
    if (req.query.workflow_id) filters.workflow_id = req.query.workflow_id;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.outcome) filters.outcome = req.query.outcome;
    if (req.query.start_date) filters.start_date = new Date(req.query.start_date);
    if (req.query.end_date) filters.end_date = new Date(req.query.end_date);
    if (req.query.search_term) filters.search_term = req.query.search_term;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const sessions = await chatAnalyticsRepo.getChatSessions(filters);

    console.log(`Retrieved ${sessions.length} chat sessions`);
    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting chat sessions:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat sessions',
      details: error.message
    });
  }
});

/**
 * Get messages for a specific session
 * GET /api/chat-analytics/sessions/:sessionId/messages
 */
router.get('/sessions/:sessionId/messages', async (req, res) => {
  console.log('=== GET SESSION MESSAGES API CALLED ===');
  console.log('Session ID:', req.params.sessionId);

  try {
    const { sessionId } = req.params;
    const messages = await chatAnalyticsRepo.getSessionMessages(sessionId);

    console.log(`Retrieved ${messages.length} messages for session ${sessionId}`);
    res.json({
      success: true,
      data: messages,
      count: messages.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting session messages:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get session messages',
      details: error.message
    });
  }
});

/**
 * Get conversation analytics (aggregated data)
 * GET /api/chat-analytics/analytics
 */
router.get('/analytics', async (req, res) => {
  console.log('=== GET CONVERSATION ANALYTICS API CALLED ===');
  console.log('Query params:', req.query);

  try {
    const filters = {};

    // Parse query parameters
    if (req.query.user_id) filters.user_id = parseInt(req.query.user_id);
    if (req.query.start_date) filters.start_date = new Date(req.query.start_date);
    if (req.query.end_date) filters.end_date = new Date(req.query.end_date);

    const analytics = await chatAnalyticsRepo.getConversationAnalytics(filters);

    console.log('Retrieved conversation analytics:', analytics);
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting conversation analytics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation analytics',
      details: error.message
    });
  }
});

/**
 * Update user analytics for a specific date
 * POST /api/chat-analytics/user-analytics/:userId
 */
router.post('/user-analytics/:userId', async (req, res) => {
  console.log('=== UPDATE USER ANALYTICS API CALLED ===');
  console.log('User ID:', req.params.userId);
  console.log('Request body:', req.body);

  try {
    const userId = parseInt(req.params.userId);
    const date = req.body.date ? new Date(req.body.date) : new Date();

    const result = await chatAnalyticsRepo.updateUserAnalytics(userId, date);

    console.log('User analytics updated successfully:', result);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error updating user analytics:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update user analytics',
      details: error.message
    });
  }
});

module.exports = router;
