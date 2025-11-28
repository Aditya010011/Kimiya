const ChatAnalyticsRepository = require('../repositories/ChatAnalyticsRepository');

/**
 * Service for handling chat analytics operations
 */
class ChatAnalyticsService {
  constructor(databaseService) {
    this.repository = new ChatAnalyticsRepository(databaseService);
  }

  /**
   * Start a new chat session
   */
  async startChatSession(sessionData) {
    try {
      console.log('🚀 Starting new chat session:', sessionData.session_id);
      
      const result = await this.repository.createChatSession({
        session_id: sessionData.session_id,
        workflow_id: sessionData.workflow_id,
        workflow_name: sessionData.workflow_name,
        user_id: sessionData.user_id,
        start_time: sessionData.start_time || new Date()
      });

      console.log('✅ Chat session started successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to start chat session:', error.message);
      throw error;
    }
  }

  /**
   * End a chat session and perform analysis
   */
  async endChatSession(sessionId, outcome = null) {
    try {
      console.log('🏁 Ending chat session:', sessionId);

      // Calculate total tokens from all messages in this session
      const tokenTotals = await this.repository.calculateSessionTokens(sessionId);
      console.log('📊 Session token totals:', tokenTotals);

      // Update session with end time, outcome, and token totals
      const updateData = {
        end_time: new Date(),
        status: 'completed',
        total_prompt_tokens: tokenTotals.total_prompt_tokens || 0,
        total_completion_tokens: tokenTotals.total_completion_tokens || 0,
        total_tokens: tokenTotals.total_tokens || 0
      };

      if (outcome) {
        updateData.outcome = outcome;
      }

      const sessionResult = await this.repository.updateChatSession(sessionId, updateData);

      // Perform conversation analysis
      await this.analyzeConversation(sessionId);

      console.log('✅ Chat session ended and analyzed successfully');
      return sessionResult;
    } catch (error) {
      console.error('❌ Failed to end chat session:', error.message);
      throw error;
    }
  }

  /**
   * Add a message to a chat session
   */
  async addMessage(sessionId, messageData) {
    try {
      console.log('💬 Adding message to session:', sessionId);

      const result = await this.repository.addChatMessage({
        message_id: messageData.id,
        session_id: sessionId,
        type: messageData.role === 'assistant' ? 'ai' : messageData.role,
        content: messageData.content,
        timestamp: messageData.timestamp || new Date(),
        node_id: messageData.nodeId,
        node_name: messageData.nodeName,
        // Extract metadata if available
        confidence_score: messageData.metadata?.confidence_score,
        processing_time: messageData.metadata?.processing_time,
        tokens_used: messageData.metadata?.tokens_used,
        prompt_tokens: messageData.metadata?.prompt_tokens,
        completion_tokens: messageData.metadata?.completion_tokens,
        total_tokens: messageData.metadata?.tokens_used || messageData.metadata?.total_tokens,
        intent_detected: messageData.metadata?.intent_detected,
        entities_extracted: messageData.metadata?.entities_extracted
      });

      console.log('✅ Message added successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to add message:', error.message);
      throw error;
    }
  }

  /**
   * Analyze conversation sentiment and engagement
   */
  async analyzeConversation(sessionId) {
    try {
      console.log('🔍 Analyzing conversation:', sessionId);

      // Get all messages for the session
      const messages = await this.repository.getSessionMessages(sessionId);

      if (messages.length === 0) {
        console.log('⚠️ No messages found for analysis');
        return null;
      }

      // Calculate basic analytics
      const analysis = this.calculateConversationMetrics(messages);

      // Store analysis results
      const result = await this.repository.upsertConversationAnalysis(sessionId, analysis);

      console.log('✅ Conversation analysis completed:', analysis);
      return result;
    } catch (error) {
      console.error('❌ Failed to analyze conversation:', error.message);
      throw error;
    }
  }

  /**
   * Calculate conversation metrics from messages
   */
  calculateConversationMetrics(messages) {
    const userMessages = messages.filter(m => m.type === 'user');
    const aiMessages = messages.filter(m => m.type === 'ai');
    
    // Calculate sentiment score (simplified approach)
    const sentimentScore = this.calculateSentimentScore(messages);
    
    // Calculate engagement level based on message count and length
    const engagementLevel = this.calculateEngagementLevel(messages);
    
    // Identify success indicators and failure points
    const successIndicators = this.identifySuccessIndicators(messages);
    const failurePoints = this.identifyFailurePoints(messages);
    
    // Calculate workflow adherence (simplified)
    const workflowAdherence = this.calculateWorkflowAdherence(messages);

    return {
      sentiment_score: sentimentScore,
      engagement_level: engagementLevel,
      user_satisfaction: this.estimateUserSatisfaction(sentimentScore, engagementLevel),
      workflow_adherence: workflowAdherence,
      success_indicators: successIndicators,
      failure_points: failurePoints
    };
  }

  /**
   * Calculate sentiment score from messages (simplified approach)
   */
  calculateSentimentScore(messages) {
    const userMessages = messages.filter(m => m.type === 'user');
    
    if (userMessages.length === 0) return 0;

    let totalSentiment = 0;
    let messageCount = 0;

    userMessages.forEach(message => {
      const sentiment = this.analyzeSentiment(message.content);
      totalSentiment += sentiment;
      messageCount++;
    });

    return messageCount > 0 ? totalSentiment / messageCount : 0;
  }

  /**
   * Simple sentiment analysis (can be replaced with more sophisticated NLP)
   */
  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'satisfied', 'thank', 'thanks', 'helpful', 'awesome', 'brilliant'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'frustrated', 'disappointed', 'confused', 'problem', 'issue', 'error', 'wrong', 'fail', 'broken'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });

    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate engagement level based on message patterns
   */
  calculateEngagementLevel(messages) {
    const userMessages = messages.filter(m => m.type === 'user');
    const totalMessages = messages.length;
    
    if (totalMessages === 0) return 'low';

    // Calculate average message length
    const avgMessageLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / Math.max(userMessages.length, 1);
    
    // Calculate engagement score based on multiple factors
    let engagementScore = 0;
    
    // Factor 1: Message count (more messages = higher engagement)
    if (totalMessages >= 10) engagementScore += 2;
    else if (totalMessages >= 5) engagementScore += 1;
    
    // Factor 2: Average message length (longer messages = higher engagement)
    if (avgMessageLength >= 50) engagementScore += 2;
    else if (avgMessageLength >= 20) engagementScore += 1;
    
    // Factor 3: User message ratio (balanced conversation = higher engagement)
    const userMessageRatio = userMessages.length / totalMessages;
    if (userMessageRatio >= 0.3 && userMessageRatio <= 0.7) engagementScore += 1;

    // Determine engagement level
    if (engagementScore >= 4) return 'high';
    if (engagementScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Estimate user satisfaction based on sentiment and engagement
   */
  estimateUserSatisfaction(sentimentScore, engagementLevel) {
    let satisfaction = 3; // Base satisfaction (neutral)

    // Adjust based on sentiment
    satisfaction += sentimentScore * 2; // -2 to +2 adjustment

    // Adjust based on engagement
    if (engagementLevel === 'high') satisfaction += 0.5;
    else if (engagementLevel === 'low') satisfaction -= 0.5;

    // Ensure satisfaction is within 1-5 range
    return Math.max(1, Math.min(5, satisfaction));
  }

  /**
   * Identify success indicators in the conversation
   */
  identifySuccessIndicators(messages) {
    const indicators = [];
    const successPhrases = ['thank you', 'thanks', 'helpful', 'solved', 'resolved', 'perfect', 'exactly', 'great'];

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      successPhrases.forEach(phrase => {
        if (content.includes(phrase)) {
          indicators.push(`User expressed satisfaction: "${phrase}"`);
        }
      });
    });

    // Check for task completion patterns
    if (messages.some(m => m.content.toLowerCase().includes('complete') || m.content.toLowerCase().includes('done'))) {
      indicators.push('Task completion indicated');
    }

    return [...new Set(indicators)]; // Remove duplicates
  }

  /**
   * Identify failure points in the conversation
   */
  identifyFailurePoints(messages) {
    const failurePoints = [];
    const failurePhrases = ['confused', 'don\'t understand', 'not working', 'error', 'problem', 'issue', 'frustrated', 'help'];

    messages.forEach(message => {
      const content = message.content.toLowerCase();
      failurePhrases.forEach(phrase => {
        if (content.includes(phrase)) {
          failurePoints.push(`User expressed difficulty: "${phrase}"`);
        }
      });
    });

    // Check for repetitive questions (indicates confusion)
    const userMessages = messages.filter(m => m.type === 'user');
    const questionCount = userMessages.filter(m => m.content.includes('?')).length;
    if (questionCount > userMessages.length * 0.7) {
      failurePoints.push('High question-to-statement ratio indicates confusion');
    }

    return [...new Set(failurePoints)]; // Remove duplicates
  }

  /**
   * Calculate workflow adherence (simplified)
   */
  calculateWorkflowAdherence(messages) {
    // This is a simplified calculation
    // In a real implementation, you would compare against the actual workflow steps
    
    const totalMessages = messages.length;
    const aiMessages = messages.filter(m => m.type === 'ai');
    
    if (totalMessages === 0) return 0;

    // Assume good adherence if AI is responding appropriately
    const adherenceScore = (aiMessages.length / totalMessages) * 100;
    
    return Math.min(100, adherenceScore);
  }

  /**
   * Get chat analytics for dashboard
   */
  async getChatAnalytics(filters = {}) {
    try {
      console.log('📊 Getting chat analytics with filters:', filters);
      
      const analytics = await this.repository.getConversationAnalytics(filters);
      
      console.log('✅ Chat analytics retrieved successfully');
      return analytics;
    } catch (error) {
      console.error('❌ Failed to get chat analytics:', error.message);
      throw error;
    }
  }

  /**
   * Get chat sessions for dashboard
   */
  async getChatSessions(filters = {}) {
    try {
      console.log('📋 Getting chat sessions with filters:', filters);
      
      const sessions = await this.repository.getChatSessions(filters);
      
      // Enrich sessions with messages if requested
      if (filters.include_messages) {
        for (const session of sessions) {
          session.messages = await this.repository.getSessionMessages(session.session_id);
        }
      }
      
      console.log(`✅ Retrieved ${sessions.length} chat sessions`);
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get chat sessions:', error.message);
      throw error;
    }
  }
}

module.exports = ChatAnalyticsService;
