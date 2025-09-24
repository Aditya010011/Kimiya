import { getApiBaseUrl } from '@/utils/envConfig';
import { TokenManager } from './authService';
import { ChatSession, ConversationAnalytics } from '@/types/userAnalytics';

export interface ChatAnalyticsFilters {
  user_id?: number;
  workflow_id?: string;
  status?: 'active' | 'completed' | 'abandoned' | 'failed';
  outcome?: 'success' | 'partial_success' | 'failure' | 'abandoned';
  start_date?: string;
  end_date?: string;
  search_term?: string;
  limit?: number;
  offset?: number;
  include_messages?: boolean;
}

export interface CreateSessionData {
  session_id: string;
  workflow_id?: string;
  workflow_name: string;
  user_id: number;
  start_time?: string;
}

export interface UpdateSessionData {
  end_time?: string;
  status?: 'active' | 'completed' | 'abandoned' | 'failed';
  outcome?: 'success' | 'partial_success' | 'failure' | 'abandoned';
  completion_rate?: number;
}

export interface AddMessageData {
  message_id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp?: string;
  node_id?: string;
  node_name?: string;
  metadata?: {
    confidence_score?: number;
    processing_time?: number;
    tokens_used?: number;
    intent_detected?: string;
    entities_extracted?: Record<string, any>;
  };
}

export interface ConversationAnalysisData {
  sentiment_score?: number;
  engagement_level?: 'low' | 'medium' | 'high';
  user_satisfaction?: number;
  workflow_adherence?: number;
  success_indicators?: string[];
  failure_points?: string[];
}

/**
 * Service for interacting with chat analytics API
 */
export class ChatAnalyticsService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = getApiBaseUrl();
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    // For now, skip authentication since we're in development
    // TODO: Implement proper authentication when needed
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a new chat session
   */
  async createChatSession(sessionData: CreateSessionData): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to create chat session:', error);
      throw error;
    }
  }

  /**
   * Update a chat session
   */
  async updateChatSession(sessionId: string, updateData: UpdateSessionData): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions/${sessionId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to update chat session:', error);
      throw error;
    }
  }

  /**
   * Add a message to a chat session
   */
  async addChatMessage(sessionId: string, messageData: AddMessageData): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to add chat message:', error);
      throw error;
    }
  }

  /**
   * Update conversation analysis
   */
  async updateConversationAnalysis(sessionId: string, analysisData: ConversationAnalysisData): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions/${sessionId}/analysis`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(analysisData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to update conversation analysis:', error);
      throw error;
    }
  }

  /**
   * Get chat sessions with filtering
   */
  async getChatSessions(filters: ChatAnalyticsFilters = {}): Promise<ChatSession[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions?${queryParams}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return this.transformSessionsData(result.data);
    } catch (error) {
      console.error('Failed to get chat sessions:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific session
   */
  async getSessionMessages(sessionId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/sessions/${sessionId}/messages`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get session messages:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics (aggregated data)
   */
  async getConversationAnalytics(filters: ChatAnalyticsFilters = {}): Promise<ConversationAnalytics> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiBaseUrl}/api/chat-analytics/analytics?${queryParams}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return this.transformAnalyticsData(result.data);
    } catch (error) {
      console.error('Failed to get conversation analytics:', error);
      throw error;
    }
  }

  /**
   * Transform sessions data to match frontend interface
   */
  private transformSessionsData(sessions: any[]): ChatSession[] {
    return sessions.map(session => ({
      session_id: session.session_id,
      workflow_id: session.workflow_id,
      workflow_name: session.workflow_name,
      user_id: session.user_id,
      start_time: session.start_time,
      end_time: session.end_time,
      duration: session.duration || 0,
      message_count: session.message_count || 0,
      status: session.status as 'active' | 'completed' | 'abandoned' | 'failed',
      outcome: session.outcome as 'success' | 'partial_success' | 'failure' | 'abandoned',
      completion_rate: session.completion_rate || 0,
      messages: session.messages || [],
      analysis: {
        sentiment_score: session.analysis?.sentiment_score || 0,
        engagement_level: session.analysis?.engagement_level || 'medium',
        success_indicators: session.analysis?.success_indicators || [],
        failure_points: session.analysis?.failure_points || [],
        user_satisfaction: session.analysis?.user_satisfaction || 3,
        workflow_adherence: session.analysis?.workflow_adherence || 0
      }
    }));
  }

  /**
   * Transform analytics data to match frontend interface
   */
  private transformAnalyticsData(data: any): ConversationAnalytics {
    return {
      total_sessions: data.total_sessions || 0,
      completed_sessions: data.completed_sessions || 0,
      abandoned_sessions: data.abandoned_sessions || 0,
      failed_sessions: data.failed_sessions || 0,
      success_rate: data.success_rate || 0,
      average_session_duration: data.average_session_duration || 0,
      average_messages_per_session: data.average_messages_per_session || 0,
      total_messages: data.total_messages || 0,
      average_sentiment_score: data.average_sentiment_score || 0,
      engagement_distribution: data.engagement_distribution || { high: 0, medium: 0, low: 0 },
      completion_rate: data.completion_rate || 0,
      outcome_distribution: data.outcome_distribution || { success: 0, partial_success: 0, failure: 0, abandoned: 0 },
      // Additional fields to match the interface
      most_active_workflows: [],
      peak_usage_hours: [],
      user_satisfaction_trend: [],
      common_failure_points: [],
      workflow_performance: []
    };
  }
}

// Export singleton instance
export const chatAnalyticsService = new ChatAnalyticsService();
