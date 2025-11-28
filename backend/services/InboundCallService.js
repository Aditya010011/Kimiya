/**
 * Inbound Call Service for Kimiya Voice AI
 * 
 * Handles inbound call processing using traditional TwiML approach
 * (NOT ConversationRelay - completely separate from outbound system)
 */

const sql = require('mssql');
const databaseService = require('./database');

class InboundCallService {
  constructor() {
    this.isInitialized = false;
    this.activeCalls = new Map(); // Track active inbound calls
    this.callSteps = new Map(); // Track conversation steps per call
  }

  /**
   * Initialize the inbound call service
   */
  async initialize() {
    try {
      console.log('🎯 Initializing Inbound Call Service...');
      
      // Ensure database connection
      await databaseService.connect();
      
      this.isInitialized = true;
      console.log('✅ Inbound Call Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Inbound Call Service:', error.message);
      throw error;
    }
  }

  /**
   * Start tracking a new inbound call
   */
  async startInboundCall(callData) {
    try {
      console.log('📞 Starting inbound call tracking:', callData.CallSid);

      const pool = await databaseService.getPool();
      
      // Insert into tblInboundCalls
      const result = await pool.request()
        .input('call_sid', sql.NVarChar(255), callData.CallSid)
        .input('from_number', sql.NVarChar(50), callData.From)
        .input('to_number', sql.NVarChar(50), callData.To)
        .input('workflow_id', sql.NVarChar(255), callData.workflowId || null)
        .input('workflow_name', sql.NVarChar(255), callData.workflowName || null)
        .input('call_status', sql.NVarChar(50), callData.CallStatus || 'initiated')
        .input('caller_city', sql.NVarChar(100), callData.FromCity || null)
        .input('caller_state', sql.NVarChar(50), callData.FromState || null)
        .input('caller_country', sql.NVarChar(50), callData.FromCountry || null)
        .input('caller_zip', sql.NVarChar(20), callData.FromZip || null)
        .input('forwarded_from', sql.NVarChar(50), callData.ForwardedFrom || null)
        .input('caller_name', sql.NVarChar(255), callData.CallerName || null)
        .query(`
          INSERT INTO tblInboundCalls (
            call_sid, from_number, to_number, workflow_id, workflow_name,
            call_status, caller_city, caller_state, caller_country, 
            caller_zip, forwarded_from, caller_name
          )
          VALUES (
            @call_sid, @from_number, @to_number, @workflow_id, @workflow_name,
            @call_status, @caller_city, @caller_state, @caller_country,
            @caller_zip, @forwarded_from, @caller_name
          );
          SELECT SCOPE_IDENTITY() as id;
        `);

      const callId = result.recordset[0].id;
      
      // Store in memory for quick access
      this.activeCalls.set(callData.CallSid, {
        id: callId,
        callSid: callData.CallSid,
        fromNumber: callData.From,
        toNumber: callData.To,
        workflowId: callData.workflowId,
        workflowName: callData.workflowName,
        startTime: new Date(),
        stepCount: 0,
        currentStep: null,
        conversationHistory: [], // Track conversation for Azure OpenAI context
        currentNodeId: null // Track current workflow node
      });

      console.log('✅ Inbound call tracking started:', { callId, callSid: callData.CallSid });
      return { success: true, callId, callSid: callData.CallSid };

    } catch (error) {
      console.error('❌ Failed to start inbound call tracking:', error.message);
      throw error;
    }
  }

  /**
   * Log a conversation step
   */
  async logCallStep(callSid, stepData) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        throw new Error(`No active call found for CallSid: ${callSid}`);
      }

      const pool = await databaseService.getPool();
      
      // Increment step count
      callInfo.stepCount++;
      
      // Insert step into database
      await pool.request()
        .input('call_id', sql.Int, callInfo.id)
        .input('call_sid', sql.NVarChar(255), callSid)
        .input('step_number', sql.Int, callInfo.stepCount)
        .input('step_type', sql.NVarChar(50), stepData.stepType)
        .input('step_action', sql.NVarChar(100), stepData.stepAction || null)
        .input('user_input', sql.NVarChar(sql.MAX), stepData.userInput || null)
        .input('ai_response', sql.NVarChar(sql.MAX), stepData.aiResponse || null)
        .input('node_name', sql.NVarChar(255), stepData.nodeName || stepData.nodeId || null)
        .input('processing_time', sql.Int, stepData.processingTime || null)
        .input('confidence_score', sql.Decimal(3, 2), stepData.confidenceScore || null)
        .query(`
          INSERT INTO tblInboundCallSteps (
            call_id, call_sid, step_number, step_type, step_action,
            user_input, ai_response, node_name,
            processing_time, confidence_score
          )
          VALUES (
            @call_id, @call_sid, @step_number, @step_type, @step_action,
            @user_input, @ai_response, @node_name,
            @processing_time, @confidence_score
          )
        `);

      // Update current step in memory
      callInfo.currentStep = stepData;

      console.log('📝 Call step logged:', { 
        callSid, 
        stepNumber: callInfo.stepCount, 
        stepType: stepData.stepType 
      });

      return { success: true, stepNumber: callInfo.stepCount };

    } catch (error) {
      console.error('❌ Failed to log call step:', error.message);
      throw error;
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(callSid, status, additionalData = {}) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for status update: ${callSid}`);
        return { success: false, message: 'Call not found' };
      }

      const pool = await databaseService.getPool();
      
      // Prepare update query
      let updateFields = ['call_status = @call_status', 'updated_at = GETDATE()'];
      let request = pool.request()
        .input('call_sid', sql.NVarChar(255), callSid)
        .input('call_status', sql.NVarChar(50), status);

      // Add optional fields
      if (additionalData.duration) {
        updateFields.push('duration = @duration');
        request.input('duration', sql.Int, additionalData.duration);
      }
      
      if (additionalData.recordingUrl) {
        updateFields.push('recording_url = @recording_url');
        request.input('recording_url', sql.NVarChar(500), additionalData.recordingUrl);
      }
      
      if (additionalData.recordingDuration) {
        updateFields.push('recording_duration = @recording_duration');
        request.input('recording_duration', sql.Int, additionalData.recordingDuration);
      }

      if (status === 'answered' && !additionalData.answerTime) {
        updateFields.push('answer_time = GETDATE()');
      } else if (additionalData.answerTime) {
        updateFields.push('answer_time = @answer_time');
        request.input('answer_time', sql.DateTime2, additionalData.answerTime);
      }

      // Add token usage if provided
      if (additionalData.total_prompt_tokens !== undefined) {
        updateFields.push('total_prompt_tokens = @total_prompt_tokens');
        request.input('total_prompt_tokens', sql.Int, additionalData.total_prompt_tokens);
      }

      if (additionalData.total_completion_tokens !== undefined) {
        updateFields.push('total_completion_tokens = @total_completion_tokens');
        request.input('total_completion_tokens', sql.Int, additionalData.total_completion_tokens);
      }

      if (additionalData.total_tokens !== undefined) {
        updateFields.push('total_tokens = @total_tokens');
        request.input('total_tokens', sql.Int, additionalData.total_tokens);
      }

      if (status === 'completed' || status === 'failed' || status === 'no-answer') {
        updateFields.push('end_time = GETDATE()');
      } else if (additionalData.endTime) {
        updateFields.push('end_time = @end_time');
        request.input('end_time', sql.DateTime2, additionalData.endTime);
      }

      // Execute update
      await request.query(`
        UPDATE tblInboundCalls 
        SET ${updateFields.join(', ')}
        WHERE call_sid = @call_sid
      `);

      // Update memory
      callInfo.status = status;
      if (additionalData.duration) callInfo.duration = additionalData.duration;

      console.log('🔄 Call status updated:', { callSid, status });
      return { success: true, status };

    } catch (error) {
      console.error('❌ Failed to update call status:', error.message);
      throw error;
    }
  }

  /**
   * End call and perform cleanup
   */
  async endCall(callSid, endData = {}) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for ending: ${callSid}`);
        return { success: false, message: 'Call not found' };
      }

      // Calculate duration if not provided
      const duration = endData.duration || 
        Math.floor((new Date() - callInfo.startTime) / 1000);

      // Update call status to completed with token usage
      await this.updateCallStatus(callSid, 'completed', {
        duration,
        recordingUrl: endData.recordingUrl,
        recordingDuration: endData.recordingDuration,
        endTime: new Date(),
        total_prompt_tokens: endData.total_prompt_tokens,
        total_completion_tokens: endData.total_completion_tokens,
        total_tokens: endData.total_tokens
      });

      // Generate analytics if we have enough data
      if (callInfo.stepCount > 0) {
        await this.generateCallAnalytics(callSid);
      }

      // Remove from active calls
      this.activeCalls.delete(callSid);
      this.callSteps.delete(callSid);

      console.log('🏁 Call ended successfully:', { callSid, duration });
      return { success: true, duration, stepCount: callInfo.stepCount };

    } catch (error) {
      console.error('❌ Failed to end call:', error.message);
      throw error;
    }
  }

  /**
   * Update token usage for a call
   */
  async updateTokenUsage(callSid, tokenUsage) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for token update: ${callSid}`);
        return { success: false, message: 'Call not found' };
      }

      // Update call with token usage
      await this.updateCallStatus(callSid, callInfo.status, {
        total_prompt_tokens: tokenUsage.total_prompt_tokens || 0,
        total_completion_tokens: tokenUsage.total_completion_tokens || 0,
        total_tokens: tokenUsage.total_tokens || 0
      });

      console.log('📊 Token usage updated:', { callSid, tokenUsage });
      return { success: true, tokenUsage };

    } catch (error) {
      console.error('❌ Failed to update token usage:', error.message);
      throw error;
    }
  }

  /**
   * Generate analytics for completed call
   */
  async generateCallAnalytics(callSid) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        throw new Error(`No call info found for analytics: ${callSid}`);
      }

      const pool = await databaseService.getPool();
      
      // Get all steps for this call
      const stepsResult = await pool.request()
        .input('call_sid', sql.NVarChar(255), callSid)
        .query(`
          SELECT * FROM tblInboundCallSteps 
          WHERE call_sid = @call_sid 
          ORDER BY step_number
        `);

      const steps = stepsResult.recordset;
      
      // Calculate basic analytics
      const analytics = this.calculateCallAnalytics(steps);
      
      // Insert analytics
      await pool.request()
        .input('call_id', sql.Int, callInfo.id)
        .input('call_sid', sql.NVarChar(255), callSid)
        .input('total_steps', sql.Int, steps.length)
        .input('completion_rate', sql.Decimal(5, 2), analytics.completionRate)
        .input('sentiment_score', sql.Decimal(3, 2), analytics.sentimentScore)
        .input('engagement_level', sql.NVarChar(50), analytics.engagementLevel)
        .input('success_indicators', sql.NVarChar(sql.MAX), JSON.stringify(analytics.successIndicators))
        .input('call_outcome', sql.NVarChar(100), analytics.callOutcome)
        .input('key_topics', sql.NVarChar(sql.MAX), JSON.stringify(analytics.keyTopics))
        .input('action_items', sql.NVarChar(sql.MAX), JSON.stringify(analytics.actionItems))
        .query(`
          INSERT INTO tblInboundCallAnalytics (
            call_id, call_sid, total_steps, completion_rate, sentiment_score,
            engagement_level, success_indicators, call_outcome,
            key_topics, action_items
          )
          VALUES (
            @call_id, @call_sid, @total_steps, @completion_rate, @sentiment_score,
            @engagement_level, @success_indicators, @call_outcome,
            @key_topics, @action_items
          )
        `);

      console.log('📊 Call analytics generated:', { callSid, outcome: analytics.callOutcome });
      return analytics;

    } catch (error) {
      console.error('❌ Failed to generate call analytics:', error.message);
      throw error;
    }
  }

  /**
   * Calculate analytics from call steps
   */
  calculateCallAnalytics(steps) {
    // Basic analytics calculation
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.ai_response).length;
    const completionRate = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    // Simple sentiment analysis based on step completion and user inputs
    let sentimentScore = 0;
    if (completionRate > 80) sentimentScore = 0.5;
    else if (completionRate > 50) sentimentScore = 0.2;
    else sentimentScore = -0.2;
    
    // Engagement level based on interaction count
    let engagementLevel = 'low';
    if (totalSteps > 10) engagementLevel = 'high';
    else if (totalSteps > 5) engagementLevel = 'medium';
    
    // Determine call outcome
    let callOutcome = 'completed';
    if (completionRate < 30) callOutcome = 'abandoned';
    else if (completionRate < 70) callOutcome = 'partial';
    
    return {
      completionRate: Math.round(completionRate * 100) / 100,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      engagementLevel,
      callOutcome,
      successIndicators: completionRate > 70 ? ['high_completion', 'good_engagement'] : [],
      failurePoints: completionRate < 50 ? ['low_completion', 'early_abandonment'] : [],
      keyTopics: ['general_inquiry'], // Simplified - could be enhanced with NLP
      actionItems: callOutcome === 'completed' ? ['follow_up_recommended'] : ['retry_contact']
    };
  }

  /**
   * Get active call information
   */
  getActiveCall(callSid) {
    return this.activeCalls.get(callSid);
  }

  /**
   * Get all active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get call statistics
   */
  getCallStats() {
    const activeCalls = this.getActiveCalls();
    return {
      totalActiveCalls: activeCalls.length,
      averageStepsPerCall: activeCalls.length > 0
        ? activeCalls.reduce((sum, call) => sum + call.stepCount, 0) / activeCalls.length
        : 0,
      longestActiveCall: activeCalls.length > 0
        ? Math.max(...activeCalls.map(call => (new Date() - call.startTime) / 1000))
        : 0
    };
  }

  /**
   * Add message to conversation history
   */
  addConversationMessage(callSid, role, content, metadata = {}) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for conversation history: ${callSid}`);
        return false;
      }

      const message = {
        role: role, // 'user', 'assistant', or 'system'
        content: content,
        timestamp: new Date(),
        ...metadata
      };

      callInfo.conversationHistory.push(message);

      // Keep conversation history manageable (last 20 messages)
      if (callInfo.conversationHistory.length > 20) {
        callInfo.conversationHistory = callInfo.conversationHistory.slice(-20);
      }

      console.log(`💬 Added ${role} message to conversation history for ${callSid}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to add conversation message:', error.message);
      return false;
    }
  }

  /**
   * Get conversation history for a call
   */
  getConversationHistory(callSid) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for conversation history: ${callSid}`);
        return [];
      }

      return callInfo.conversationHistory || [];

    } catch (error) {
      console.error('❌ Failed to get conversation history:', error.message);
      return [];
    }
  }

  /**
   * Update current workflow node for a call
   */
  updateCurrentNode(callSid, nodeId) {
    try {
      const callInfo = this.activeCalls.get(callSid);
      if (!callInfo) {
        console.warn(`⚠️ No active call found for node update: ${callSid}`);
        return false;
      }

      callInfo.currentNodeId = nodeId;
      callInfo.currentStep = nodeId; // Keep backward compatibility

      console.log(`🔄 Updated current node for ${callSid}: ${nodeId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to update current node:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const inboundCallService = new InboundCallService();
module.exports = inboundCallService;
