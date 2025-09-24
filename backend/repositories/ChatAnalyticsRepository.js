const sql = require('mssql');

/**
 * Repository for managing chat analytics data
 */
class ChatAnalyticsRepository {
  constructor(databaseService) {
    this.db = databaseService;
  }

  /**
   * Create a new chat session
   */
  async createChatSession(sessionData) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      const result = await request
        .input('sessionId', sql.NVarChar, sessionData.session_id)
        .input('workflowId', sql.NVarChar, sessionData.workflow_id || null)
        .input('workflowName', sql.NVarChar, sessionData.workflow_name)
        .input('userId', sql.Int, sessionData.user_id)
        .input('startTime', sql.DateTime2, sessionData.start_time || new Date())
        .query(`
          INSERT INTO tblChatSessions (session_id, workflow_id, workflow_name, user_id, start_time, status)
          VALUES (@sessionId, @workflowId, @workflowName, @userId, @startTime, 'active')
        `);

      // Get the inserted record
      const selectRequest = pool.request();
      const selectResult = await selectRequest
        .input('sessionId', sql.NVarChar, sessionData.session_id)
        .query(`
          SELECT id, session_id, created_at
          FROM tblChatSessions
          WHERE session_id = @sessionId
        `);

      return selectResult.recordset[0];
    } catch (error) {
      console.error('❌ Failed to create chat session:', error.message);
      throw error;
    }
  }

  /**
   * Update chat session (end session, set outcome, etc.)
   */
  async updateChatSession(sessionId, updateData) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      // Build dynamic update query based on provided data
      const updateFields = [];
      const params = { sessionId };

      if (updateData.end_time !== undefined) {
        updateFields.push('end_time = @endTime');
        request.input('endTime', sql.DateTime2, updateData.end_time);
      }

      if (updateData.status !== undefined) {
        updateFields.push('status = @status');
        request.input('status', sql.NVarChar, updateData.status);
      }

      if (updateData.outcome !== undefined) {
        updateFields.push('outcome = @outcome');
        request.input('outcome', sql.NVarChar, updateData.outcome);
      }

      if (updateData.completion_rate !== undefined) {
        updateFields.push('completion_rate = @completionRate');
        request.input('completionRate', sql.Decimal(5, 2), updateData.completion_rate);
      }

      updateFields.push('updated_at = GETDATE()');

      if (updateFields.length === 1) { // Only updated_at
        return null;
      }

      const result = await request
        .input('sessionId', sql.NVarChar, sessionId)
        .query(`
          UPDATE tblChatSessions
          SET ${updateFields.join(', ')}
          WHERE session_id = @sessionId
        `);

      // Get the updated record
      const selectRequest = pool.request();
      const selectResult = await selectRequest
        .input('sessionId', sql.NVarChar, sessionId)
        .query(`
          SELECT id, session_id, status, outcome
          FROM tblChatSessions
          WHERE session_id = @sessionId
        `);

      return selectResult.recordset[0] || null;
    } catch (error) {
      console.error('❌ Failed to update chat session:', error.message);
      throw error;
    }
  }

  /**
   * Add a message to a chat session
   */
  async addChatMessage(messageData) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      // First, get the session database ID from session_id
      const sessionResult = await request
        .input('sessionId', sql.NVarChar, messageData.session_id)
        .query('SELECT id FROM tblChatSessions WHERE session_id = @sessionId');

      if (sessionResult.recordset.length === 0) {
        throw new Error(`Chat session not found: ${messageData.session_id}`);
      }

      const sessionDbId = sessionResult.recordset[0].id;

      // Insert the message
      const result = await pool.request()
        .input('messageId', sql.NVarChar, messageData.message_id)
        .input('sessionId', sql.Int, sessionDbId)
        .input('type', sql.NVarChar, messageData.type)
        .input('content', sql.NVarChar, messageData.content)
        .input('timestamp', sql.DateTime2, messageData.timestamp || new Date())
        .input('nodeId', sql.NVarChar, messageData.node_id || null)
        .input('nodeName', sql.NVarChar, messageData.node_name || null)
        .input('confidenceScore', sql.Decimal(3, 2), messageData.confidence_score || null)
        .input('processingTime', sql.Int, messageData.processing_time || null)
        .input('tokensUsed', sql.Int, messageData.tokens_used || null)
        .input('intentDetected', sql.NVarChar, messageData.intent_detected || null)
        .input('entitiesExtracted', sql.NVarChar, messageData.entities_extracted ? JSON.stringify(messageData.entities_extracted) : null)
        .query(`
          INSERT INTO tblChatMessages (
            message_id, session_id, type, content, timestamp, node_id, node_name,
            confidence_score, processing_time, tokens_used, intent_detected, entities_extracted
          )
          VALUES (
            @messageId, @sessionId, @type, @content, @timestamp, @nodeId, @nodeName,
            @confidenceScore, @processingTime, @tokensUsed, @intentDetected, @entitiesExtracted
          )
        `);

      // Get the inserted record
      const selectRequest = pool.request();
      const selectResult = await selectRequest
        .input('messageId', sql.NVarChar, messageData.message_id)
        .query(`
          SELECT id, message_id, created_at
          FROM tblChatMessages
          WHERE message_id = @messageId
        `);

      return selectResult.recordset[0];
    } catch (error) {
      console.error('❌ Failed to add chat message:', error.message);
      throw error;
    }
  }

  /**
   * Create or update conversation analysis
   */
  async upsertConversationAnalysis(sessionId, analysisData) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      // Get session database ID
      const sessionResult = await request
        .input('sessionId', sql.NVarChar, sessionId)
        .query('SELECT id FROM tblChatSessions WHERE session_id = @sessionId');

      if (sessionResult.recordset.length === 0) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }

      const sessionDbId = sessionResult.recordset[0].id;

      // Upsert analysis data
      const result = await pool.request()
        .input('sessionId', sql.Int, sessionDbId)
        .input('sentimentScore', sql.Decimal(3, 2), analysisData.sentiment_score || 0)
        .input('engagementLevel', sql.NVarChar, analysisData.engagement_level || 'medium')
        .input('userSatisfaction', sql.Decimal(2, 1), analysisData.user_satisfaction || null)
        .input('workflowAdherence', sql.Decimal(5, 2), analysisData.workflow_adherence || null)
        .input('successIndicators', sql.NVarChar, analysisData.success_indicators ? JSON.stringify(analysisData.success_indicators) : null)
        .input('failurePoints', sql.NVarChar, analysisData.failure_points ? JSON.stringify(analysisData.failure_points) : null)
        .query(`
          MERGE tblConversationAnalysis AS target
          USING (SELECT @sessionId as session_id) AS source
          ON target.session_id = source.session_id
          WHEN MATCHED THEN
            UPDATE SET 
              sentiment_score = @sentimentScore,
              engagement_level = @engagementLevel,
              user_satisfaction = @userSatisfaction,
              workflow_adherence = @workflowAdherence,
              success_indicators = @successIndicators,
              failure_points = @failurePoints,
              analyzed_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (session_id, sentiment_score, engagement_level, user_satisfaction, 
                   workflow_adherence, success_indicators, failure_points, analyzed_at)
            VALUES (@sessionId, @sentimentScore, @engagementLevel, @userSatisfaction,
                   @workflowAdherence, @successIndicators, @failurePoints, GETDATE())
        `);

      // Get the upserted record
      const selectRequest = pool.request();
      const selectResult = await selectRequest
        .input('sessionId', sql.NVarChar, sessionId)
        .query(`
          SELECT id, session_id, analyzed_at
          FROM tblConversationAnalysis
          WHERE session_id = @sessionId
        `);

      return selectResult.recordset[0];
    } catch (error) {
      console.error('❌ Failed to upsert conversation analysis:', error.message);
      throw error;
    }
  }

  /**
   * Get chat sessions with filters
   */
  async getChatSessions(filters = {}) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      let whereClause = 'WHERE 1=1';
      
      if (filters.user_id) {
        whereClause += ' AND s.user_id = @userId';
        request.input('userId', sql.Int, filters.user_id);
      }

      if (filters.workflow_id) {
        whereClause += ' AND s.workflow_id = @workflowId';
        request.input('workflowId', sql.NVarChar, filters.workflow_id);
      }

      if (filters.status) {
        whereClause += ' AND s.status = @status';
        request.input('status', sql.NVarChar, filters.status);
      }

      if (filters.outcome) {
        whereClause += ' AND s.outcome = @outcome';
        request.input('outcome', sql.NVarChar, filters.outcome);
      }

      if (filters.start_date) {
        whereClause += ' AND s.start_time >= @startDate';
        request.input('startDate', sql.DateTime2, filters.start_date);
      }

      if (filters.end_date) {
        whereClause += ' AND s.start_time <= @endDate';
        request.input('endDate', sql.DateTime2, filters.end_date);
      }

      if (filters.search_term) {
        whereClause += ' AND (s.workflow_name LIKE @searchTerm OR s.session_id LIKE @searchTerm)';
        request.input('searchTerm', sql.NVarChar, `%${filters.search_term}%`);
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const result = await request
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
          SELECT 
            s.id,
            s.session_id,
            s.workflow_id,
            s.workflow_name,
            s.user_id,
            s.start_time,
            s.end_time,
            s.duration,
            s.message_count,
            s.status,
            s.outcome,
            s.completion_rate,
            s.created_at,
            s.updated_at,
            a.sentiment_score,
            a.engagement_level,
            a.user_satisfaction,
            a.workflow_adherence,
            a.success_indicators,
            a.failure_points,
            u.email as user_email,
            u.first_name,
            u.last_name
          FROM tblChatSessions s
          LEFT JOIN tblConversationAnalysis a ON s.id = a.session_id
          LEFT JOIN tblUsers u ON s.user_id = u.id
          ${whereClause}
          ORDER BY s.start_time DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `);

      return result.recordset.map(row => ({
        session_id: row.session_id,
        workflow_id: row.workflow_id,
        workflow_name: row.workflow_name,
        user_id: row.user_id,
        start_time: row.start_time,
        end_time: row.end_time,
        duration: row.duration,
        message_count: row.message_count,
        status: row.status,
        outcome: row.outcome,
        completion_rate: row.completion_rate,
        analysis: {
          sentiment_score: row.sentiment_score,
          engagement_level: row.engagement_level,
          user_satisfaction: row.user_satisfaction,
          workflow_adherence: row.workflow_adherence,
          success_indicators: row.success_indicators ? JSON.parse(row.success_indicators) : [],
          failure_points: row.failure_points ? JSON.parse(row.failure_points) : []
        },
        user: {
          email: row.user_email,
          first_name: row.first_name,
          last_name: row.last_name
        }
      }));
    } catch (error) {
      console.error('❌ Failed to get chat sessions:', error.message);
      throw error;
    }
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(sessionId) {
    try {
      const pool = await this.db.connect();
      const result = await pool.request()
        .input('sessionId', sql.NVarChar, sessionId)
        .query(`
          SELECT
            m.message_id as id,
            m.type,
            m.content,
            m.timestamp,
            m.node_id,
            m.node_name,
            m.confidence_score,
            m.processing_time,
            m.tokens_used,
            m.intent_detected,
            m.entities_extracted
          FROM tblChatMessages m
          INNER JOIN tblChatSessions s ON m.session_id = s.id
          WHERE s.session_id = @sessionId
          ORDER BY m.timestamp ASC
        `);

      return result.recordset.map(row => ({
        id: row.id,
        type: row.type,
        content: row.content,
        timestamp: row.timestamp,
        metadata: {
          node_id: row.node_id,
          node_name: row.node_name,
          confidence_score: row.confidence_score,
          processing_time: row.processing_time,
          tokens_used: row.tokens_used,
          intent_detected: row.intent_detected,
          entities_extracted: row.entities_extracted ? JSON.parse(row.entities_extracted) : null
        }
      }));
    } catch (error) {
      console.error('❌ Failed to get session messages:', error.message);
      throw error;
    }
  }

  /**
   * Get conversation analytics aggregated data
   */
  async getConversationAnalytics(filters = {}) {
    try {
      const pool = await this.db.connect();
      const request = pool.request();

      let whereClause = 'WHERE 1=1';

      if (filters.user_id) {
        whereClause += ' AND s.user_id = @userId';
        request.input('userId', sql.Int, filters.user_id);
      }

      if (filters.start_date) {
        whereClause += ' AND s.start_time >= @startDate';
        request.input('startDate', sql.DateTime2, filters.start_date);
      }

      if (filters.end_date) {
        whereClause += ' AND s.start_time <= @endDate';
        request.input('endDate', sql.DateTime2, filters.end_date);
      }

      const result = await request.query(`
        SELECT
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
          COUNT(CASE WHEN s.status = 'abandoned' THEN 1 END) as abandoned_sessions,
          COUNT(CASE WHEN s.status = 'failed' THEN 1 END) as failed_sessions,
          SUM(s.message_count) as total_messages,
          SUM(s.duration) as total_duration,
          AVG(CAST(s.duration as FLOAT)) as average_session_duration,
          AVG(CAST(s.message_count as FLOAT)) as average_messages_per_session,
          AVG(CAST(a.sentiment_score as FLOAT)) as average_sentiment_score,
          COUNT(CASE WHEN a.engagement_level = 'high' THEN 1 END) as high_engagement_sessions,
          COUNT(CASE WHEN a.engagement_level = 'medium' THEN 1 END) as medium_engagement_sessions,
          COUNT(CASE WHEN a.engagement_level = 'low' THEN 1 END) as low_engagement_sessions,
          AVG(CAST(s.completion_rate as FLOAT)) as average_completion_rate,
          COUNT(CASE WHEN s.outcome = 'success' THEN 1 END) as successful_sessions,
          COUNT(CASE WHEN s.outcome = 'partial_success' THEN 1 END) as partial_success_sessions,
          COUNT(CASE WHEN s.outcome = 'failure' THEN 1 END) as failed_outcome_sessions
        FROM tblChatSessions s
        LEFT JOIN tblConversationAnalysis a ON s.id = a.session_id
        ${whereClause}
      `);

      const data = result.recordset[0];
      const totalSessions = data.total_sessions || 0;

      return {
        total_sessions: totalSessions,
        completed_sessions: data.completed_sessions || 0,
        abandoned_sessions: data.abandoned_sessions || 0,
        failed_sessions: data.failed_sessions || 0,
        success_rate: totalSessions > 0 ? ((data.successful_sessions || 0) / totalSessions * 100) : 0,
        average_session_duration: data.average_session_duration || 0,
        average_messages_per_session: data.average_messages_per_session || 0,
        total_messages: data.total_messages || 0,
        average_sentiment_score: data.average_sentiment_score || 0,
        engagement_distribution: {
          high: data.high_engagement_sessions || 0,
          medium: data.medium_engagement_sessions || 0,
          low: data.low_engagement_sessions || 0
        },
        completion_rate: data.average_completion_rate || 0,
        outcome_distribution: {
          success: data.successful_sessions || 0,
          partial_success: data.partial_success_sessions || 0,
          failure: data.failed_outcome_sessions || 0,
          abandoned: data.abandoned_sessions || 0
        }
      };
    } catch (error) {
      console.error('❌ Failed to get conversation analytics:', error.message);
      throw error;
    }
  }

  /**
   * Update or create daily user analytics
   */
  async updateUserAnalytics(userId, date = new Date()) {
    try {
      const pool = await this.db.connect();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('datePeriod', sql.Date, dateStr)
        .query(`
          MERGE tblUserAnalytics AS target
          USING (
            SELECT
              @userId as user_id,
              @datePeriod as date_period,
              COUNT(*) as total_sessions,
              COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
              COUNT(CASE WHEN s.status = 'abandoned' THEN 1 END) as abandoned_sessions,
              COUNT(CASE WHEN s.status = 'failed' THEN 1 END) as failed_sessions,
              SUM(s.message_count) as total_messages,
              SUM(s.duration) as total_duration,
              AVG(CAST(s.duration as FLOAT)) as average_session_duration,
              AVG(CAST(s.message_count as FLOAT)) as average_messages_per_session,
              CASE
                WHEN COUNT(*) > 0 THEN
                  CAST(COUNT(CASE WHEN s.outcome = 'success' THEN 1 END) as FLOAT) / COUNT(*) * 100
                ELSE 0
              END as success_rate,
              AVG(CAST(a.sentiment_score as FLOAT)) as average_sentiment_score,
              COUNT(CASE WHEN a.engagement_level = 'high' THEN 1 END) as high_engagement_sessions,
              COUNT(CASE WHEN a.engagement_level = 'medium' THEN 1 END) as medium_engagement_sessions,
              COUNT(CASE WHEN a.engagement_level = 'low' THEN 1 END) as low_engagement_sessions
            FROM tblChatSessions s
            LEFT JOIN tblConversationAnalysis a ON s.id = a.session_id
            WHERE s.user_id = @userId
              AND CAST(s.start_time as DATE) = @datePeriod
          ) AS source ON target.user_id = source.user_id AND target.date_period = source.date_period
          WHEN MATCHED THEN
            UPDATE SET
              total_sessions = source.total_sessions,
              completed_sessions = source.completed_sessions,
              abandoned_sessions = source.abandoned_sessions,
              failed_sessions = source.failed_sessions,
              total_messages = source.total_messages,
              total_duration = source.total_duration,
              average_session_duration = source.average_session_duration,
              average_messages_per_session = source.average_messages_per_session,
              success_rate = source.success_rate,
              average_sentiment_score = source.average_sentiment_score,
              high_engagement_sessions = source.high_engagement_sessions,
              medium_engagement_sessions = source.medium_engagement_sessions,
              low_engagement_sessions = source.low_engagement_sessions,
              updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (user_id, date_period, total_sessions, completed_sessions, abandoned_sessions,
                   failed_sessions, total_messages, total_duration, average_session_duration,
                   average_messages_per_session, success_rate, average_sentiment_score,
                   high_engagement_sessions, medium_engagement_sessions, low_engagement_sessions)
            VALUES (source.user_id, source.date_period, source.total_sessions, source.completed_sessions,
                   source.abandoned_sessions, source.failed_sessions, source.total_messages,
                   source.total_duration, source.average_session_duration, source.average_messages_per_session,
                   source.success_rate, source.average_sentiment_score, source.high_engagement_sessions,
                   source.medium_engagement_sessions, source.low_engagement_sessions)
        `);

      // Get the upserted record
      const selectRequest = pool.request();
      const selectResult = await selectRequest
        .input('userId', sql.Int, userId)
        .input('datePeriod', sql.Date, datePeriod)
        .query(`
          SELECT id, user_id, date_period
          FROM tblUserAnalytics
          WHERE user_id = @userId AND date_period = @datePeriod
        `);

      return selectResult.recordset[0];
    } catch (error) {
      console.error('❌ Failed to update user analytics:', error.message);
      throw error;
    }
  }
}

module.exports = ChatAnalyticsRepository;
