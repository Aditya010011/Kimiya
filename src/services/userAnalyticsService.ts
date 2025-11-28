import {
  UserAnalyticsData,
  AdvancedUserAnalyticsData,
  UserProfile,
  TwilioMetrics,
  ConversationAnalytics,
  CallManagement,
  TokenUsage,
  WorkflowActivity,
  SystemAnalytics,
  AnalyticsFilters,
  ExportOptions,
  CallSession,
  CohortAnalysis,
  FunnelAnalysis,
  UserJourney,
  BehavioralMetrics,
  RealtimeMetrics,
  DashboardLayout
} from '@/types/userAnalytics';
import { getApiBaseUrl } from '@/utils/envConfig';
import { TokenManager } from './authService';

export class UserAnalyticsService {
  private static baseUrl = getApiBaseUrl();

  /**
   * Get comprehensive analytics data for a specific user
   */
  static async getUserAnalytics(userId: number, filters?: AnalyticsFilters): Promise<UserAnalyticsData> {
    try {
      const token = TokenManager.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/user-analytics/${userId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Map backend data to frontend format
        const backendData = result.data;
        return {
          user_profile: backendData.user_profile,
          twilio_metrics: {
            phone_numbers_used: [],
            total_calls_made: backendData.twilio_metrics.total_calls_made,
            total_call_duration: backendData.twilio_metrics.total_call_duration,
            average_call_duration: backendData.twilio_metrics.average_call_duration,
            successful_calls: backendData.twilio_metrics.successful_calls,
            failed_calls: backendData.twilio_metrics.failed_calls,
            api_requests_count: 0,
            monthly_usage: [],
            cost_breakdown: {
              voice_calls: 0,
              sms: 0,
              api_requests: 0,
              total: parseFloat(backendData.cost_metrics.estimated_monthly_cost)
            }
          },
          conversation_analytics: {
            total_conversations: backendData.conversation_analytics.total_conversations,
            average_conversation_length: backendData.conversation_analytics.average_conversation_length,
            total_messages_sent: 0,
            total_messages_received: 0,
            conversation_topics: [],
            sentiment_analysis: { positive: 0, neutral: 0, negative: 0 },
            recent_conversations: []
          },
          call_management: {
            total_calls: backendData.twilio_metrics.total_calls_made,
            successful_calls: backendData.twilio_metrics.successful_calls,
            failed_calls: backendData.twilio_metrics.failed_calls,
            average_duration: backendData.twilio_metrics.average_call_duration,
            total_duration: backendData.twilio_metrics.total_call_duration,
            call_sessions: [],
            call_trends: [],
            peak_hours: []
          },
          token_usage: {
            twilio_tokens: { used: 0, limit: 0, cost: 0, last_reset: new Date().toISOString() },
            openai_tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost: 0, model_usage: [] },
            usage_trends: [],
            monthly_limits: { twilio_limit: 0, openai_limit: 0, current_usage_percentage: 0 }
          },
          workflow_activity: {
            created_workflows: backendData.workflow_activity.created_workflows,
            active_workflows: backendData.workflow_activity.active_workflows,
            total_executions: backendData.workflow_activity.total_executions,
            successful_executions: backendData.workflow_activity.successful_executions,
            failed_executions: backendData.workflow_activity.failed_executions,
            workflows: [],
            execution_history: []
          },
          system_analytics: {
            login_patterns: { total_logins: 0, unique_days: 0, average_session_duration: 0, login_history: [], login_trends: [] },
            feature_usage: { workflow_builder: 0, dashboard_views: 0, api_calls: 0, exports: 0, imports: 0 },
            error_logs: [],
            performance_metrics: { average_page_load_time: 0, api_response_times: [], uptime_percentage: 100 }
          },
          last_updated: backendData.last_updated
        };
      } else {
        throw new Error(result.error || 'Failed to fetch user analytics');
      }
    } catch (error) {
      console.error('Failed to fetch user analytics, falling back to mock data:', error);
      // Fallback to mock data if API fails
      return this.generateMockAnalyticsData(userId, filters);
    }
  }

  /**
   * Get advanced analytics data with real-time features
   */
  static async getAdvancedUserAnalytics(userId: number, filters?: AnalyticsFilters): Promise<AdvancedUserAnalyticsData> {
    const baseData = await this.getUserAnalytics(userId, filters);

    // Fetch real call records and analytics from backend
    let callRecords = this.generateMockCallRecords(userId);
    let callAnalytics = this.generateUserSpecificCallAnalytics(userId);

    try {
      const callData = await this.getUserCallRecords(userId);
      if (callData.call_records && callData.call_records.length > 0) {
        callRecords = callData.call_records;
        callAnalytics = callData.call_analytics;
        console.log(`✅ Loaded ${callRecords.length} real call records for user ${userId}`);
      } else {
        console.log(`⚠️ No real call records found for user ${userId}, using mock data`);
      }
    } catch (error) {
      console.error('Failed to fetch real call records, falling back to mock data:', error);
    }

    const advancedData: AdvancedUserAnalyticsData = {
      ...baseData,
      // ALL DATA FILTERED BY USER ID - NO SYSTEM-WIDE AGGREGATIONS
      cohort_analysis: this.generateUserSpecificCohortAnalysis(userId),
      funnel_analysis: this.generateUserSpecificFunnelAnalysis(userId),
      user_journeys: this.generateMockUserJourneys(userId),
      behavioral_metrics: this.generateUserSpecificBehavioralMetrics(userId),
      realtime_metrics: this.generateUserSpecificRealtimeMetrics(userId),
      custom_dashboards: this.generateMockDashboardLayouts(),
      // New chat and call analytics
      chat_analytics: this.generateUserSpecificChatAnalytics(userId),
      chat_sessions: this.generateMockChatSessions(userId),
      call_analytics: callAnalytics,
      call_records: callRecords,
      alerts: this.generateUserSpecificAlerts(userId)
    };
    return advancedData;
  }

  /**
   * Get user call records from backend
   */
  static async getUserCallRecords(userId: number): Promise<{ call_records: any[], call_analytics: any }> {
    try {
      const token = TokenManager.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/user-analytics/${userId}/call-records`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to fetch call records');
      }
    } catch (error) {
      console.error('Failed to fetch call records:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics (called frequently)
   */
  static async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    try {
      const token = TokenManager.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/realtime-metrics`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to fetch real-time metrics');
      }
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
      // Return fallback data instead of throwing
      return {
        active_users_now: 0,
        active_sessions: 0,
        current_calls: 0,
        api_requests_per_minute: 0,
        error_rate_last_hour: 0,
        system_health: 'critical', // System is critical if we can't fetch metrics
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Stream real-time data updates
   */
  static subscribeToRealtimeUpdates(callback: (data: RealtimeMetrics) => void): () => void {
    const interval = setInterval(async () => {
      const metrics = await this.getRealtimeMetrics();
      callback(metrics);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }

  /**
   * Export user analytics data
   */
  static async exportUserAnalytics(userId: number, options: ExportOptions): Promise<Blob> {
    const data = await this.getUserAnalytics(userId);

    switch (options.format) {
      case 'json':
        return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      case 'csv':
        return this.generateCSVExport(data, options);
      case 'pdf':
        return this.generatePDFExport(data, options);
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Generate mock analytics data for development/demo purposes
   */
  private static generateMockAnalyticsData(userId: number, filters?: AnalyticsFilters): UserAnalyticsData {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      user_profile: this.generateMockUserProfile(userId),
      // ALL METRICS FILTERED BY USER ID - NO SYSTEM-WIDE DATA
      twilio_metrics: this.generateUserSpecificTwilioMetrics(userId),
      conversation_analytics: this.generateUserSpecificConversationAnalytics(userId),
      call_management: this.generateUserSpecificCallManagement(userId),
      token_usage: this.generateUserSpecificTokenUsage(userId),
      workflow_activity: this.generateUserSpecificWorkflowActivity(userId),
      system_analytics: this.generateUserSpecificSystemAnalytics(userId),
      last_updated: now.toISOString()
    };
  }

  private static generateMockUserProfile(userId: number): UserProfile {
    // Generate realistic user data based on userId to ensure each user has unique profile
    const firstNames = [
      'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria',
      'William', 'Jennifer', 'Richard', 'Linda', 'Charles', 'Patricia', 'Joseph', 'Susan', 'Thomas', 'Jessica',
      'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra',
      'Donald', 'Donna', 'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
      'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah', 'Edward', 'Dorothy'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
      'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
      'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
    ];

    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'business.org', 'enterprise.net'];

    // Use userId to consistently generate the same user data
    const firstNameIndex = userId % firstNames.length;
    const lastNameIndex = Math.floor(userId / firstNames.length) % lastNames.length;
    const domainIndex = userId % domains.length;

    const firstName = firstNames[firstNameIndex];
    const lastName = lastNames[lastNameIndex];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domains[domainIndex]}`;

    // Consistent random seed for this user
    const userSeed = userId * 12345;
    const randomDays = (userSeed % 365) + 1; // 1-365 days ago for creation
    const randomHours = (userSeed % 24) + 1; // 1-24 hours ago for last login

    return {
      id: userId,
      email: email,
      first_name: firstName,
      last_name: lastName,
      role: userId === 1 ? 'admin' : 'user', // Only user ID 1 is admin
      is_active: (userSeed % 10) !== 0, // 90% of users are active
      created_at: new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - (userSeed % 7) * 24 * 60 * 60 * 1000).toISOString(),
      last_login: new Date(Date.now() - randomHours * 60 * 60 * 1000).toISOString(),
    };
  }

  private static generateMockTwilioMetrics(): TwilioMetrics {
    return {
      phone_numbers_used: ['+1234567890', '+1987654321'],
      total_calls_made: 156,
      total_call_duration: 18420, // in seconds
      average_call_duration: 118,
      successful_calls: 142,
      failed_calls: 14,
      api_requests_count: 1240,
      monthly_usage: Array.from({ length: 6 }, (_, i) => ({
        month: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        calls: Math.floor(Math.random() * 50) + 20,
        duration: Math.floor(Math.random() * 5000) + 1000,
        cost: Math.floor(Math.random() * 100) + 20
      })),
      cost_breakdown: {
        voice_calls: 245.67,
        sms: 12.34,
        api_requests: 8.90,
        total: 266.91
      }
    };
  }

  private static generateMockConversationAnalytics(): ConversationAnalytics {
    return {
      total_conversations: 89,
      average_conversation_length: 4.2,
      total_messages_sent: 234,
      total_messages_received: 198,
      conversation_topics: [
        { topic: 'Customer Support', count: 34, percentage: 38.2 },
        { topic: 'Sales Inquiry', count: 28, percentage: 31.5 },
        { topic: 'Technical Issues', count: 15, percentage: 16.9 },
        { topic: 'General Questions', count: 12, percentage: 13.5 }
      ],
      sentiment_analysis: {
        positive: 65.2,
        neutral: 28.1,
        negative: 6.7
      },
      recent_conversations: Array.from({ length: 10 }, (_, i) => ({
        id: `conv_${i + 1}`,
        timestamp: new Date(Date.now() - i * 2 * 60 * 60 * 1000).toISOString(),
        duration: Math.floor(Math.random() * 300) + 60,
        message_count: Math.floor(Math.random() * 10) + 3,
        topic: ['Customer Support', 'Sales Inquiry', 'Technical Issues'][Math.floor(Math.random() * 3)],
        sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as 'positive' | 'neutral' | 'negative'
      }))
    };
  }

  private static generateMockCallManagement(): CallManagement {
    const callSessions: CallSession[] = Array.from({ length: 25 }, (_, i) => ({
      id: `call_${i + 1}`,
      phone_number: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      start_time: new Date(Date.now() - i * 3 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - i * 3 * 60 * 60 * 1000 + Math.random() * 600 * 1000).toISOString(),
      duration: Math.floor(Math.random() * 600) + 30,
      status: ['completed', 'failed', 'cancelled'][Math.floor(Math.random() * 3)] as 'completed' | 'failed' | 'cancelled',
      call_type: Math.random() > 0.5 ? 'inbound' : 'outbound',
      workflow_id: Math.floor(Math.random() * 5) + 1,
      workflow_name: ['Customer Support', 'Sales Flow', 'Survey Collection'][Math.floor(Math.random() * 3)],
      transcript: 'Sample call transcript...',
      summary: 'Call summary and key points...',
      cost: Math.random() * 5 + 0.5,
      recording_url: `https://recordings.example.com/call_${i + 1}.mp3`
    }));

    return {
      total_calls: callSessions.length,
      successful_calls: callSessions.filter(c => c.status === 'completed').length,
      failed_calls: callSessions.filter(c => c.status === 'failed').length,
      average_duration: callSessions.reduce((sum, c) => sum + c.duration, 0) / callSessions.length,
      total_duration: callSessions.reduce((sum, c) => sum + c.duration, 0),
      call_sessions: callSessions,
      call_trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        calls: Math.floor(Math.random() * 10) + 1,
        duration: Math.floor(Math.random() * 3000) + 500,
        success_rate: Math.random() * 20 + 80
      })),
      peak_hours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        call_count: Math.floor(Math.random() * 15) + (hour >= 9 && hour <= 17 ? 5 : 0)
      }))
    };
  }

  private static generateMockTokenUsage(): TokenUsage {
    return {
      twilio_tokens: {
        used: 8420,
        limit: 10000,
        cost: 84.20,
        last_reset: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      openai_tokens: {
        prompt_tokens: 45230,
        completion_tokens: 23450,
        total_tokens: 68680,
        cost: 137.36,
        model_usage: [
          { model: 'gpt-4', tokens: 25000, cost: 75.00 },
          { model: 'gpt-3.5-turbo', tokens: 43680, cost: 62.36 }
        ]
      },
      usage_trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        twilio_tokens: Math.floor(Math.random() * 500) + 100,
        openai_tokens: Math.floor(Math.random() * 3000) + 1000,
        total_cost: Math.random() * 20 + 5
      })),
      monthly_limits: {
        twilio_limit: 10000,
        openai_limit: 100000,
        current_usage_percentage: 68.7
      }
    };
  }

  private static generateMockWorkflowActivity(): WorkflowActivity {
    return {
      created_workflows: 8,
      active_workflows: 5,
      total_executions: 234,
      successful_executions: 198,
      failed_executions: 36,
      workflows: Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `Workflow ${i + 1}`,
        created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_executed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        execution_count: Math.floor(Math.random() * 50) + 10,
        success_rate: Math.random() * 20 + 75,
        average_duration: Math.random() * 300 + 60,
        status: ['active', 'draft', 'archived'][Math.floor(Math.random() * 3)] as 'active' | 'draft' | 'archived'
      })),
      execution_history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        executions: Math.floor(Math.random() * 15) + 5,
        success_rate: Math.random() * 20 + 75,
        average_duration: Math.random() * 200 + 100
      }))
    };
  }

  private static generateMockSystemAnalytics(): SystemAnalytics {
    return {
      login_patterns: {
        total_logins: 156,
        unique_days: 45,
        average_session_duration: 2340, // in seconds
        login_history: Array.from({ length: 20 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString(),
          ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          session_duration: Math.floor(Math.random() * 7200) + 300
        })),
        login_trends: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          logins: Math.floor(Math.random() * 8) + 1
        }))
      },
      feature_usage: {
        workflow_builder: 89,
        dashboard_views: 234,
        api_calls: 1456,
        exports: 12,
        imports: 8
      },
      error_logs: Array.from({ length: 15 }, (_, i) => ({
        id: `error_${i + 1}`,
        timestamp: new Date(Date.now() - i * 4 * 60 * 60 * 1000).toISOString(),
        error_type: ['ValidationError', 'NetworkError', 'AuthError'][Math.floor(Math.random() * 3)],
        error_message: 'Sample error message',
        stack_trace: 'Error stack trace...',
        resolved: Math.random() > 0.3
      })),
      performance_metrics: {
        average_page_load_time: 1.2,
        api_response_times: [
          { endpoint: '/api/workflows', average_time: 245, slowest_time: 890, fastest_time: 120 },
          { endpoint: '/api/auth/login', average_time: 156, slowest_time: 340, fastest_time: 89 },
          { endpoint: '/api/twilio-config', average_time: 89, slowest_time: 234, fastest_time: 45 }
        ],
        uptime_percentage: 99.8
      }
    };
  }

  private static generateCSVExport(data: UserAnalyticsData, options: ExportOptions): Blob {
    // Simple CSV generation for demo purposes
    let csv = 'Section,Metric,Value\n';

    if (options.sections.includes('user_profile')) {
      csv += `User Profile,Email,${data.user_profile.email}\n`;
      csv += `User Profile,Role,${data.user_profile.role}\n`;
      csv += `User Profile,Status,${data.user_profile.is_active ? 'Active' : 'Inactive'}\n`;
    }

    if (options.sections.includes('twilio_metrics')) {
      csv += `Twilio,Total Calls,${data.twilio_metrics.total_calls_made}\n`;
      csv += `Twilio,Success Rate,${((data.twilio_metrics.successful_calls / data.twilio_metrics.total_calls_made) * 100).toFixed(1)}%\n`;
      csv += `Twilio,Total Cost,$${data.twilio_metrics.cost_breakdown.total}\n`;
    }

    return new Blob([csv], { type: 'text/csv' });
  }

  private static generatePDFExport(data: UserAnalyticsData, options: ExportOptions): Blob {
    // For demo purposes, return a simple text blob
    // In production, you would use a PDF library like jsPDF
    const content = `User Analytics Report\n\nUser: ${data.user_profile.email}\nGenerated: ${new Date().toISOString()}\n\nThis would be a formatted PDF report.`;
    return new Blob([content], { type: 'application/pdf' });
  }

  // Advanced Mock Data Generators
  private static generateMockCohortAnalysis(): CohortAnalysis[] {
    return Array.from({ length: 12 }, (_, i) => {
      const cohortDate = new Date();
      cohortDate.setMonth(cohortDate.getMonth() - i);

      return {
        cohort_date: cohortDate.toISOString().slice(0, 7),
        cohort_size: Math.floor(Math.random() * 500) + 100,
        retention_rates: {
          day_0: 100,
          day_1: Math.random() * 20 + 70,
          day_7: Math.random() * 15 + 50,
          day_14: Math.random() * 10 + 40,
          day_30: Math.random() * 10 + 30,
          day_60: Math.random() * 8 + 25,
          day_90: Math.random() * 5 + 20
        },
        revenue_per_cohort: Math.random() * 10000 + 5000,
        ltv: Math.random() * 500 + 200
      };
    });
  }

  private static generateMockFunnelAnalysis(): FunnelAnalysis[] {
    const funnels = [
      {
        name: 'User Onboarding',
        steps: ['Sign Up', 'Email Verification', 'Profile Setup', 'First Workflow', 'First Call']
      },
      {
        name: 'Call Conversion',
        steps: ['Call Initiated', 'Call Connected', 'Conversation Started', 'Call Completed', 'Follow-up Action']
      },
      {
        name: 'Feature Adoption',
        steps: ['Feature Discovery', 'First Use', 'Regular Usage', 'Advanced Features', 'Power User']
      }
    ];

    return funnels.map((funnel, index) => {
      let totalUsers = Math.floor(Math.random() * 1000) + 500;
      const steps = funnel.steps.map((stepName, stepIndex) => {
        const dropOffRate = Math.random() * 0.3 + 0.1; // 10-40% drop-off
        const usersCompleted = Math.floor(totalUsers * (1 - dropOffRate));

        const step = {
          step_name: stepName,
          step_order: stepIndex + 1,
          users_entered: totalUsers,
          users_completed: usersCompleted,
          conversion_rate: (usersCompleted / totalUsers) * 100,
          drop_off_rate: dropOffRate * 100,
          average_time_to_complete: Math.random() * 300 + 60
        };

        totalUsers = usersCompleted;
        return step;
      });

      return {
        funnel_name: funnel.name,
        total_users: steps[0]?.users_entered || 0,
        overall_conversion_rate: steps.length > 0 ? (steps[steps.length - 1].users_completed / steps[0].users_entered) * 100 : 0,
        steps,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  }

  private static generateMockUserJourneys(userId: number): UserJourney[] {
    return Array.from({ length: 10 }, (_, i) => {
      const journeyStart = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const journeyDuration = Math.random() * 3600 + 300; // 5 minutes to 1 hour
      const journeyEnd = new Date(journeyStart.getTime() + journeyDuration * 1000);

      const touchpoints = Array.from({ length: Math.floor(Math.random() * 10) + 3 }, (_, j) => {
        const touchpointTime = new Date(journeyStart.getTime() + (j * journeyDuration * 1000) / 10);
        return {
          timestamp: touchpointTime.toISOString(),
          event_type: ['page_view', 'click', 'form_submit', 'api_call', 'workflow_trigger'][Math.floor(Math.random() * 5)],
          event_name: ['Dashboard View', 'Workflow Builder', 'Call Initiated', 'Settings Updated', 'Export Data'][Math.floor(Math.random() * 5)],
          page_url: `/dashboard/${Math.floor(Math.random() * 5)}`,
          duration_on_page: Math.random() * 300 + 30,
          metadata: {
            user_agent: 'Mozilla/5.0...',
            ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`
          }
        };
      });

      return {
        session_id: `session_${userId}_${i}`,
        user_id: userId,
        journey_start: journeyStart.toISOString(),
        journey_end: journeyEnd.toISOString(),
        total_duration: journeyDuration,
        touchpoints,
        conversion_events: ['workflow_created', 'call_completed'],
        exit_point: touchpoints[touchpoints.length - 1]?.event_name
      };
    });
  }

  private static generateMockBehavioralMetrics(): BehavioralMetrics {
    return {
      session_duration: {
        average: 1847, // ~30 minutes
        median: 1245,
        percentile_90: 3600,
        distribution: [
          { range: '0-5 min', count: 45 },
          { range: '5-15 min', count: 123 },
          { range: '15-30 min', count: 89 },
          { range: '30-60 min', count: 67 },
          { range: '60+ min', count: 34 }
        ]
      },
      page_views: {
        total: 2847,
        unique: 1923,
        bounce_rate: 23.4,
        pages_per_session: 4.7
      },
      engagement_score: 78.5,
      feature_adoption: [
        { feature_name: 'Workflow Builder', adoption_rate: 89.2, first_use_time: 234, usage_frequency: 12.3 },
        { feature_name: 'Call Management', adoption_rate: 76.8, first_use_time: 567, usage_frequency: 8.9 },
        { feature_name: 'Analytics Dashboard', adoption_rate: 45.6, first_use_time: 890, usage_frequency: 3.2 },
        { feature_name: 'API Integration', adoption_rate: 23.4, first_use_time: 1234, usage_frequency: 1.8 },
        { feature_name: 'Advanced Reporting', adoption_rate: 12.1, first_use_time: 2345, usage_frequency: 0.9 }
      ]
    };
  }

  private static generateMockRealtimeMetrics(): RealtimeMetrics {
    return {
      active_users_now: Math.floor(Math.random() * 50) + 10,
      active_sessions: Math.floor(Math.random() * 75) + 15,
      current_calls: Math.floor(Math.random() * 20) + 2,
      api_requests_per_minute: Math.floor(Math.random() * 200) + 50,
      error_rate_last_hour: Math.random() * 5,
      system_health: Math.random() > 0.8 ? 'warning' : Math.random() > 0.95 ? 'critical' : 'healthy',
      last_updated: new Date().toISOString()
    };
  }

  private static generateMockDashboardLayouts(): DashboardLayout[] {
    return [
      {
        id: 'default',
        name: 'Default Dashboard',
        is_default: true,
        widgets: [
          {
            id: 'widget_1',
            type: 'metric',
            title: 'Active Users',
            position: { x: 0, y: 0, w: 3, h: 2 },
            config: { metric: 'active_users', color: 'blue' },
            data_source: 'realtime',
            refresh_interval: 30,
            is_visible: true
          },
          {
            id: 'widget_2',
            type: 'chart',
            title: 'Call Volume Trend',
            position: { x: 3, y: 0, w: 6, h: 4 },
            config: { chart_type: 'line', time_range: '7d' },
            data_source: 'calls',
            refresh_interval: 300,
            is_visible: true
          },
          {
            id: 'widget_3',
            type: 'funnel',
            title: 'Conversion Funnel',
            position: { x: 9, y: 0, w: 3, h: 4 },
            config: { funnel_id: 'onboarding' },
            data_source: 'funnels',
            refresh_interval: 3600,
            is_visible: true
          }
        ],
        filters: {
          date_range: {
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
          }
        },
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'performance',
        name: 'Performance Dashboard',
        is_default: false,
        widgets: [
          {
            id: 'perf_widget_1',
            type: 'chart',
            title: 'Response Times',
            position: { x: 0, y: 0, w: 6, h: 3 },
            config: { chart_type: 'area', metric: 'response_time' },
            data_source: 'performance',
            refresh_interval: 60,
            is_visible: true
          },
          {
            id: 'perf_widget_2',
            type: 'heatmap',
            title: 'Usage Heatmap',
            position: { x: 6, y: 0, w: 6, h: 3 },
            config: { heatmap_type: 'hourly' },
            data_source: 'usage',
            refresh_interval: 900,
            is_visible: true
          }
        ],
        filters: {
          date_range: {
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date().toISOString()
          }
        },
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  private static generateMockAlerts() {
    return [
      {
        id: 'alert_1',
        type: 'threshold' as const,
        message: 'Call failure rate exceeded 5% in the last hour',
        severity: 'warning' as const,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        is_read: false
      },
      {
        id: 'alert_2',
        type: 'anomaly' as const,
        message: 'Unusual spike in API requests detected',
        severity: 'info' as const,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        is_read: true
      },
      {
        id: 'alert_3',
        type: 'goal' as const,
        message: 'Monthly call target achieved ahead of schedule',
        severity: 'info' as const,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        is_read: false
      }
    ];
  }

  // ========================================
  // USER-SPECIFIC DATA GENERATION METHODS
  // All methods below generate data filtered by userId
  // ========================================

  private static generateUserSpecificTwilioMetrics(userId: number): TwilioMetrics {
    // Generate user-specific call patterns based on userId
    const userSeed = userId * 1337; // Consistent seed for this user
    const baseCallCount = 20 + (userSeed % 50); // 20-70 calls per user
    const successRate = 0.85 + (userSeed % 100) / 1000; // 85-95% success rate

    return {
      phone_numbers_used: [`+1${String(userSeed).padStart(10, '0').slice(0, 10)}`],
      total_calls_made: baseCallCount,
      total_call_duration: baseCallCount * (60 + (userSeed % 180)), // 1-4 min avg per call
      average_call_duration: 60 + (userSeed % 180),
      successful_calls: Math.floor(baseCallCount * successRate),
      failed_calls: baseCallCount - Math.floor(baseCallCount * successRate),
      cost_breakdown: {
        voice_calls: (baseCallCount * 0.015) + (userSeed % 100) / 100,
        sms: (userSeed % 20) * 0.0075,
        api_requests: (userSeed % 50) * 0.005,
        total: 0
      }
    };
  }

  private static generateUserSpecificConversationAnalytics(userId: number): ConversationAnalytics {
    const userSeed = userId * 2341;
    const conversationCount = 15 + (userSeed % 35); // 15-50 conversations

    return {
      total_conversations: conversationCount,
      average_conversation_length: 3 + (userSeed % 8), // 3-11 minutes
      total_messages_sent: conversationCount * (5 + (userSeed % 15)),
      total_messages_received: conversationCount * (4 + (userSeed % 12)),
      sentiment_analysis: {
        positive: 60 + (userSeed % 25), // 60-85%
        neutral: 20 + (userSeed % 15), // 20-35%
        negative: 5 + (userSeed % 10)  // 5-15%
      },
      conversation_topics: [
        { topic: 'Product Support', count: Math.floor(conversationCount * 0.4), percentage: 40 },
        { topic: 'Billing Questions', count: Math.floor(conversationCount * 0.3), percentage: 30 },
        { topic: 'Technical Issues', count: Math.floor(conversationCount * 0.2), percentage: 20 },
        { topic: 'General Inquiry', count: Math.floor(conversationCount * 0.1), percentage: 10 }
      ]
    };
  }

  private static generateUserSpecificCallManagement(userId: number): CallManagement {
    const userSeed = userId * 3457;
    const totalCalls = 18 + (userSeed % 42); // 18-60 calls
    const successRate = 0.8 + (userSeed % 150) / 1000; // 80-95%

    return {
      total_calls: totalCalls,
      successful_calls: Math.floor(totalCalls * successRate),
      failed_calls: totalCalls - Math.floor(totalCalls * successRate),
      average_duration: 120 + (userSeed % 240), // 2-6 minutes
      call_trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        calls: Math.floor(totalCalls / 30) + ((userSeed + i) % 5),
        duration: (120 + (userSeed % 240)) * (Math.floor(totalCalls / 30) + ((userSeed + i) % 5))
      })),
      call_sessions: Array.from({ length: Math.min(totalCalls, 20) }, (_, i) => ({
        id: `call_${userId}_${i + 1}`,
        phone_number: `+1${String(userSeed + i).padStart(10, '0').slice(0, 10)}`,
        call_type: (userSeed + i) % 3 === 0 ? 'inbound' as const : 'outbound' as const,
        duration: 60 + ((userSeed + i) % 300),
        status: (userSeed + i) % 10 === 0 ? 'failed' as const : 'completed' as const,
        workflow_name: `User ${userId} Workflow ${(i % 3) + 1}`,
        cost: 0.015 + ((userSeed + i) % 100) / 10000,
        start_time: new Date(Date.now() - i * 2 * 60 * 60 * 1000).toISOString()
      }))
    };
  }

  private static generateUserSpecificTokenUsage(userId: number): TokenUsage {
    const userSeed = userId * 4573;
    const monthlyUsage = 1000 + (userSeed % 9000); // 1K-10K tokens per user

    return {
      twilio_tokens: {
        used: monthlyUsage,
        limit: 50000,
        cost: monthlyUsage * 0.002,
        last_reset: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      },
      openai_tokens: {
        prompt_tokens: Math.floor(monthlyUsage * 0.6),
        completion_tokens: Math.floor(monthlyUsage * 0.4),
        total_tokens: monthlyUsage,
        cost: monthlyUsage * 0.0015,
        model_usage: [
          { model: 'gpt-4', tokens: Math.floor(monthlyUsage * 0.7), cost: Math.floor(monthlyUsage * 0.7) * 0.002 },
          { model: 'gpt-3.5-turbo', tokens: Math.floor(monthlyUsage * 0.3), cost: Math.floor(monthlyUsage * 0.3) * 0.001 }
        ]
      },
      usage_trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tokens_used: Math.floor(monthlyUsage / 30) + ((userSeed + i) % 100),
        total_cost: (Math.floor(monthlyUsage / 30) + ((userSeed + i) % 100)) * 0.0015
      })),
      monthly_limits: {
        current_usage_percentage: (monthlyUsage / 50000) * 100,
        projected_usage: monthlyUsage * 1.1,
        days_remaining: 30 - new Date().getDate()
      }
    };
  }

  private static generateUserSpecificWorkflowActivity(userId: number): WorkflowActivity {
    const userSeed = userId * 5689;
    const workflowCount = 3 + (userSeed % 8); // 3-10 workflows per user
    const totalExecutions = workflowCount * (10 + (userSeed % 40)); // 10-50 executions per workflow

    return {
      created_workflows: workflowCount,
      active_workflows: Math.floor(workflowCount * 0.8),
      total_executions: totalExecutions,
      successful_executions: Math.floor(totalExecutions * (0.85 + (userSeed % 100) / 1000)),
      workflows: Array.from({ length: workflowCount }, (_, i) => ({
        id: `workflow_${userId}_${i + 1}`,
        name: `${['Customer Support', 'Lead Qualification', 'Appointment Booking', 'Survey Collection', 'Order Processing'][i % 5]} - User ${userId}`,
        status: (userSeed + i) % 5 === 0 ? 'inactive' as const : 'active' as const,
        execution_count: 10 + ((userSeed + i) % 40),
        success_rate: 85 + ((userSeed + i) % 15),
        average_duration: 180 + ((userSeed + i) % 300),
        created_at: new Date(Date.now() - (workflowCount - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_executed: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString()
      }))
    };
  }

  private static generateUserSpecificSystemAnalytics(userId: number): SystemAnalytics {
    const userSeed = userId * 6701;
    const loginCount = 20 + (userSeed % 80); // 20-100 logins

    return {
      login_patterns: {
        total_logins: loginCount,
        unique_days: Math.min(loginCount, 15 + (userSeed % 15)), // Max 30 unique days
        average_session_duration: 1800 + (userSeed % 3600), // 30min - 1.5hr sessions
        peak_hours: [(userSeed % 12) + 8, (userSeed % 12) + 14] // Business hours preference
      },
      feature_usage: {
        workflow_builder: 15 + (userSeed % 35),
        call_management: 25 + (userSeed % 45),
        analytics_dashboard: 8 + (userSeed % 22),
        user_settings: 5 + (userSeed % 15),
        api_integration: 3 + (userSeed % 12)
      },
      error_logs: Array.from({ length: Math.min(5, (userSeed % 10)) }, (_, i) => ({
        id: `error_${userId}_${i + 1}`,
        timestamp: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
        error_type: ['API_ERROR', 'VALIDATION_ERROR', 'TIMEOUT_ERROR'][(userSeed + i) % 3] as const,
        error_message: `User-specific error ${i + 1} for user ${userId}`,
        resolved: (userSeed + i) % 3 !== 0
      })),
      performance_metrics: {
        uptime_percentage: 99.5 + (userSeed % 50) / 1000, // 99.5-99.95%
        average_page_load_time: 1.2 + (userSeed % 800) / 1000, // 1.2-2.0 seconds
        api_response_times: [
          { endpoint: '/api/workflows', average_time: 150 + (userSeed % 200), fastest_time: 100, slowest_time: 500 },
          { endpoint: '/api/calls', average_time: 200 + (userSeed % 150), fastest_time: 120, slowest_time: 600 },
          { endpoint: '/api/analytics', average_time: 300 + (userSeed % 250), fastest_time: 200, slowest_time: 800 }
        ]
      }
    };
  }

  // ========================================
  // USER-SPECIFIC ADVANCED ANALYTICS METHODS
  // ========================================

  private static generateUserSpecificCohortAnalysis(userId: number): CohortAnalysis[] {
    const userSeed = userId * 7823;
    // Generate cohorts that this specific user belongs to
    return Array.from({ length: 3 }, (_, i) => ({
      cohort_id: `cohort_${userId}_${i + 1}`,
      cohort_name: `User ${userId} Cohort ${new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      cohort_size: 1, // This user only
      start_date: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
      retention_rates: {
        day_1: 100, // User is always retained on day 1
        day_7: 85 + (userSeed % 15),
        day_30: 70 + (userSeed % 20),
        day_90: 60 + (userSeed % 25)
      },
      ltv: 150 + (userSeed % 300), // $150-450 LTV for this user
      conversion_rate: 0.8 + (userSeed % 200) / 1000 // 80-100% (individual user)
    }));
  }

  private static generateUserSpecificFunnelAnalysis(userId: number): FunnelAnalysis[] {
    const userSeed = userId * 8934;
    // Generate funnels showing this user's progression
    return [
      {
        funnel_id: `funnel_${userId}_onboarding`,
        funnel_name: `User ${userId} Onboarding Journey`,
        total_users: 1, // This user only
        overall_conversion_rate: 85 + (userSeed % 15),
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        steps: [
          { step_name: 'Account Created', users_entered: 1, conversion_rate: 100 },
          { step_name: 'Profile Completed', users_entered: 1, conversion_rate: 100 },
          { step_name: 'First Workflow Created', users_entered: 1, conversion_rate: userSeed % 2 === 0 ? 100 : 0 },
          { step_name: 'First Call Made', users_entered: userSeed % 3 === 0 ? 1 : 0, conversion_rate: userSeed % 3 === 0 ? 100 : 0 }
        ]
      },
      {
        funnel_id: `funnel_${userId}_engagement`,
        funnel_name: `User ${userId} Feature Engagement`,
        total_users: 1,
        overall_conversion_rate: 70 + (userSeed % 20),
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        steps: [
          { step_name: 'Dashboard Visit', users_entered: 1, conversion_rate: 100 },
          { step_name: 'Workflow Builder Used', users_entered: 1, conversion_rate: 100 },
          { step_name: 'Call Initiated', users_entered: userSeed % 2 === 0 ? 1 : 0, conversion_rate: userSeed % 2 === 0 ? 100 : 0 },
          { step_name: 'Analytics Viewed', users_entered: userSeed % 4 === 0 ? 1 : 0, conversion_rate: userSeed % 4 === 0 ? 100 : 0 }
        ]
      }
    ];
  }

  private static generateUserSpecificBehavioralMetrics(userId: number): BehavioralMetrics {
    const userSeed = userId * 9045;
    const sessionCount = 15 + (userSeed % 35);

    return {
      engagement_score: 65 + (userSeed % 35), // 65-100 engagement score
      session_duration: {
        average: 1800 + (userSeed % 1800), // 30min - 1hr average
        median: 1500 + (userSeed % 1500),
        percentile_90: 3000 + (userSeed % 2000),
        distribution: [
          { range: '0-15min', count: Math.floor(sessionCount * 0.2) },
          { range: '15-30min', count: Math.floor(sessionCount * 0.3) },
          { range: '30-60min', count: Math.floor(sessionCount * 0.3) },
          { range: '60min+', count: Math.floor(sessionCount * 0.2) }
        ]
      },
      page_views: {
        total: sessionCount * (8 + (userSeed % 12)), // 8-20 pages per session
        unique: sessionCount * (5 + (userSeed % 8)),
        bounce_rate: 15 + (userSeed % 20), // 15-35% bounce rate
        pages_per_session: 5 + (userSeed % 8)
      },
      feature_adoption: [
        { feature_name: 'Workflow Builder', adoption_rate: 85 + (userSeed % 15), usage_frequency: 12 + (userSeed % 18) },
        { feature_name: 'Call Management', adoption_rate: 70 + (userSeed % 25), usage_frequency: 8 + (userSeed % 15) },
        { feature_name: 'Analytics Dashboard', adoption_rate: 45 + (userSeed % 35), usage_frequency: 5 + (userSeed % 10) },
        { feature_name: 'API Integration', adoption_rate: 25 + (userSeed % 40), usage_frequency: 2 + (userSeed % 8) }
      ]
    };
  }

  private static generateUserSpecificRealtimeMetrics(userId: number): RealtimeMetrics {
    const userSeed = userId * 1156;
    const isCurrentlyActive = userSeed % 3 === 0; // 33% chance user is currently active

    return {
      active_users_now: isCurrentlyActive ? 1 : 0, // This user only
      calls_in_progress: isCurrentlyActive && userSeed % 5 === 0 ? 1 : 0,
      system_health: 'healthy' as const,
      error_rate_last_hour: (userSeed % 50) / 1000, // 0-5% error rate
      response_time_avg: 150 + (userSeed % 200), // 150-350ms
      active_workflows: Math.floor((3 + (userSeed % 8)) * 0.8), // 80% of user's workflows active
      current_session: isCurrentlyActive ? {
        session_id: `session_${userId}_${Date.now()}`,
        start_time: new Date(Date.now() - (userSeed % 3600) * 1000).toISOString(),
        current_page: ['/dashboard', '/workflows', '/calls', '/analytics'][(userSeed % 4)],
        actions_count: userSeed % 20
      } : null
    };
  }

  private static generateUserSpecificAlerts(userId: number): any[] {
    const userSeed = userId * 1267;
    const alertCount = userSeed % 4; // 0-3 alerts per user

    return Array.from({ length: alertCount }, (_, i) => ({
      id: `alert_${userId}_${i + 1}`,
      type: ['system', 'usage', 'goal', 'error'][(userSeed + i) % 4] as const,
      message: [
        `User ${userId}: High token usage detected`,
        `User ${userId}: Workflow execution failed`,
        `User ${userId}: Monthly call target reached`,
        `User ${userId}: API rate limit approaching`
      ][(userSeed + i) % 4],
      severity: ['info', 'warning', 'error'][(userSeed + i) % 3] as const,
      timestamp: new Date(Date.now() - i * 4 * 60 * 60 * 1000).toISOString(),
      is_read: (userSeed + i) % 3 === 0
    }));
  }

  /**
   * Generate mock chat analytics for a specific user
   */
  private static generateUserSpecificChatAnalytics(userId: number) {
    const userSeed = userId * 7919; // Prime number for better distribution
    const totalSessions = 15 + (userSeed % 35); // 15-50 sessions
    const totalMessages = totalSessions * (8 + (userSeed % 12)); // 8-20 messages per session
    const successfulSessions = Math.floor(totalSessions * (0.6 + (userSeed % 30) / 100)); // 60-90% success rate

    return {
      total_sessions: totalSessions,
      total_messages: totalMessages,
      average_session_duration: 180 + (userSeed % 300), // 3-8 minutes
      average_messages_per_session: totalMessages / totalSessions,
      success_rate: successfulSessions / totalSessions,
      abandonment_rate: 1 - (successfulSessions / totalSessions),
      sentiment_distribution: {
        positive: 0.4 + (userSeed % 30) / 100, // 40-70%
        neutral: 0.2 + (userSeed % 20) / 100,  // 20-40%
        negative: 0.1 + (userSeed % 20) / 100  // 10-30%
      },
      engagement_metrics: {
        high_engagement: Math.floor(totalSessions * 0.3),
        medium_engagement: Math.floor(totalSessions * 0.5),
        low_engagement: Math.floor(totalSessions * 0.2)
      },
      workflow_performance: [
        {
          workflow_id: 'ai_teacher',
          workflow_name: 'AI Specialist Teacher',
          session_count: Math.floor(totalSessions * 0.4),
          success_rate: 0.75 + (userSeed % 20) / 100,
          average_completion_rate: 80 + (userSeed % 15),
          average_duration: 240 + (userSeed % 120)
        },
        {
          workflow_id: 'real_estate',
          workflow_name: 'Real Estate Agent',
          session_count: Math.floor(totalSessions * 0.3),
          success_rate: 0.65 + (userSeed % 25) / 100,
          average_completion_rate: 70 + (userSeed % 20),
          average_duration: 180 + (userSeed % 90)
        },
        {
          workflow_id: 'customer_service',
          workflow_name: 'Customer Service Bot',
          session_count: Math.floor(totalSessions * 0.3),
          success_rate: 0.85 + (userSeed % 10) / 100,
          average_completion_rate: 90 + (userSeed % 8),
          average_duration: 120 + (userSeed % 60)
        }
      ],
      trending_topics: [
        { topic: 'AI Learning', frequency: 15 + (userSeed % 10), sentiment: 0.7 },
        { topic: 'Property Search', frequency: 12 + (userSeed % 8), sentiment: 0.5 },
        { topic: 'Technical Support', frequency: 8 + (userSeed % 6), sentiment: 0.3 },
        { topic: 'Pricing Questions', frequency: 6 + (userSeed % 4), sentiment: 0.1 }
      ]
    };
  }

  /**
   * Generate mock chat sessions for a specific user
   */
  private static generateMockChatSessions(userId: number) {
    const userSeed = userId * 7919;
    const sessionCount = 15 + (userSeed % 35);
    const sessions = [];

    const workflows = [
      { id: 'ai_teacher', name: 'AI Specialist Teacher' },
      { id: 'real_estate', name: 'Real Estate Agent' },
      { id: 'customer_service', name: 'Customer Service Bot' }
    ];

    const outcomes = ['success', 'partial_success', 'failure', 'abandoned'];
    const engagementLevels = ['high', 'medium', 'low'];

    for (let i = 0; i < sessionCount; i++) {
      const sessionSeed = userSeed + i * 31;
      const workflow = workflows[sessionSeed % workflows.length];
      const messageCount = 5 + (sessionSeed % 15);
      const duration = 120 + (sessionSeed % 480); // 2-10 minutes
      const outcome = outcomes[sessionSeed % outcomes.length];
      const engagement = engagementLevels[sessionSeed % engagementLevels.length];

      // Generate messages
      const messages = [];
      for (let j = 0; j < messageCount; j++) {
        const isUser = j % 2 === 0;
        const messageTime = new Date(Date.now() - (sessionCount - i) * 24 * 60 * 60 * 1000 + j * 30000);

        messages.push({
          id: `msg_${userId}_${i}_${j}`,
          type: isUser ? 'user' : 'ai',
          content: isUser ?
            ['Hello, I need help with...', 'Can you explain...', 'What about...', 'I understand, but...'][j % 4] :
            ['Hello! I\'d be happy to help you with that.', 'Let me explain that for you...', 'That\'s a great question...', 'I hope that clarifies things!'][j % 4],
          timestamp: messageTime.toISOString(),
          metadata: isUser ? undefined : {
            confidence_score: 0.8 + (sessionSeed % 20) / 100,
            processing_time: 150 + (sessionSeed % 100),
            tokens_used: 50 + (sessionSeed % 100)
          }
        });
      }

      sessions.push({
        session_id: `session_${userId}_${i}`,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        user_id: userId,
        start_time: new Date(Date.now() - (sessionCount - i) * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() - (sessionCount - i) * 24 * 60 * 60 * 1000 + duration * 1000).toISOString(),
        duration,
        message_count: messageCount,
        status: outcome === 'abandoned' ? 'abandoned' : 'completed',
        outcome,
        completion_rate: outcome === 'success' ? 95 + (sessionSeed % 5) :
                        outcome === 'partial_success' ? 60 + (sessionSeed % 30) :
                        outcome === 'failure' ? 20 + (sessionSeed % 30) : 10 + (sessionSeed % 20),
        messages,
        analysis: {
          sentiment_score: outcome === 'success' ? 0.3 + (sessionSeed % 40) / 100 :
                          outcome === 'failure' ? -0.5 + (sessionSeed % 30) / 100 :
                          -0.1 + (sessionSeed % 40) / 100,
          engagement_level: engagement,
          success_indicators: outcome === 'success' ? [
            'User expressed satisfaction',
            'All questions were answered',
            'Workflow completed successfully'
          ] : [],
          failure_points: outcome === 'failure' ? [
            'User became frustrated',
            'AI failed to understand context',
            'Session ended abruptly'
          ] : [],
          user_satisfaction: outcome === 'success' ? 4 + (sessionSeed % 2) :
                           outcome === 'partial_success' ? 3 + (sessionSeed % 2) :
                           1 + (sessionSeed % 2),
          workflow_adherence: 70 + (sessionSeed % 30)
        },
        metadata: {
          session_source: 'playground',
          device_type: ['desktop', 'mobile', 'tablet'][sessionSeed % 3],
          ip_address: `192.168.${sessionSeed % 255}.${(sessionSeed * 7) % 255}`,
          user_agent: 'Mozilla/5.0 (compatible; KimiyaVoice/1.0)'
        }
      });
    }

    return sessions;
  }

  /**
   * Generate mock call analytics for a specific user
   */
  private static generateUserSpecificCallAnalytics(userId: number) {
    const userSeed = userId * 8191; // Prime number for better distribution
    const totalCalls = 25 + (userSeed % 50); // 25-75 calls
    const answeredCalls = Math.floor(totalCalls * (0.6 + (userSeed % 30) / 100)); // 60-90% answer rate
    const missedCalls = totalCalls - answeredCalls;
    const totalDuration = answeredCalls * (120 + (userSeed % 300)); // 2-7 minutes per answered call

    return {
      total_calls: totalCalls,
      answered_calls: answeredCalls,
      missed_calls: missedCalls,
      total_duration: totalDuration,
      average_duration: answeredCalls > 0 ? totalDuration / answeredCalls : 0,
      answer_rate: answeredCalls / totalCalls,
      cost_summary: {
        total_cost: totalCalls * (0.01 + (userSeed % 5) / 1000), // $0.01-0.015 per call
        average_cost_per_call: 0.01 + (userSeed % 5) / 1000,
        cost_by_direction: {
          inbound: totalCalls * 0.4 * (0.008 + (userSeed % 3) / 1000),
          outbound: totalCalls * 0.6 * (0.012 + (userSeed % 3) / 1000)
        }
      },
      call_volume_trends: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        inbound_calls: Math.floor((totalCalls * 0.4) / 30) + ((userSeed + i) % 3),
        outbound_calls: Math.floor((totalCalls * 0.6) / 30) + ((userSeed + i) % 4),
        total_duration: Math.floor(totalDuration / 30) + ((userSeed + i) % 300)
      })),
      status_distribution: {
        answered: answeredCalls,
        declined: Math.floor(missedCalls * 0.3),
        busy: Math.floor(missedCalls * 0.2),
        no_answer: Math.floor(missedCalls * 0.4),
        hung_up: Math.floor(answeredCalls * 0.1),
        failed: Math.floor(totalCalls * 0.02),
        cancelled: Math.floor(totalCalls * 0.01)
      },
      geographic_distribution: [
        { country: 'United States', state: 'California', call_count: Math.floor(totalCalls * 0.4), total_duration: Math.floor(totalDuration * 0.4) },
        { country: 'United States', state: 'New York', call_count: Math.floor(totalCalls * 0.3), total_duration: Math.floor(totalDuration * 0.3) },
        { country: 'United States', state: 'Texas', call_count: Math.floor(totalCalls * 0.2), total_duration: Math.floor(totalDuration * 0.2) },
        { country: 'Canada', call_count: Math.floor(totalCalls * 0.1), total_duration: Math.floor(totalDuration * 0.1) }
      ],
      quality_metrics: {
        average_quality_score: 3.5 + (userSeed % 15) / 10, // 3.5-5.0
        network_quality_distribution: {
          excellent: Math.floor(totalCalls * 0.4),
          good: Math.floor(totalCalls * 0.4),
          fair: Math.floor(totalCalls * 0.15),
          poor: Math.floor(totalCalls * 0.05)
        }
      }
    };
  }

  /**
   * Generate mock call records for a specific user
   */
  private static generateMockCallRecords(userId: number) {
    const userSeed = userId * 8191;
    const callCount = 25 + (userSeed % 50);
    const records = [];

    const workflows = [
      { id: 'ai_teacher', name: 'AI Specialist Teacher' },
      { id: 'real_estate', name: 'Real Estate Agent' },
      { id: 'customer_service', name: 'Customer Service Bot' }
    ];

    const statuses = ['answered', 'declined', 'busy', 'no-answer', 'hung-up', 'failed', 'cancelled'];
    const directions = ['inbound', 'outbound'];
    const networkQualities = ['excellent', 'good', 'fair', 'poor'];

    for (let i = 0; i < callCount; i++) {
      const callSeed = userSeed + i * 37;
      const direction = directions[callSeed % directions.length];
      const status = statuses[callSeed % statuses.length];
      const workflow = workflows[callSeed % workflows.length];
      const duration = status === 'answered' ? 60 + (callSeed % 420) : 0; // 1-8 minutes if answered
      const hasRecording = status === 'answered' && callSeed % 3 === 0; // 33% of answered calls have recordings
      const hasTranscription = hasRecording && callSeed % 2 === 0; // 50% of recordings have transcriptions

      records.push({
        call_id: `call_${userId}_${i}`,
        call_sid: `CA${callSeed.toString(16).padStart(32, '0')}`,
        user_id: userId,
        workflow_id: callSeed % 4 === 0 ? workflow.id : undefined,
        workflow_name: callSeed % 4 === 0 ? workflow.name : undefined,
        direction,
        from_number: direction === 'inbound' ?
          `+1${Math.floor(2000000000 + (callSeed % 8000000000))}` :
          '+17077433838', // Twilio number
        to_number: direction === 'outbound' ?
          `+1${Math.floor(2000000000 + (callSeed % 8000000000))}` :
          '+17077433838',
        status,
        start_time: new Date(Date.now() - (callCount - i) * 12 * 60 * 60 * 1000).toISOString(),
        end_time: duration > 0 ?
          new Date(Date.now() - (callCount - i) * 12 * 60 * 60 * 1000 + duration * 1000).toISOString() :
          undefined,
        duration,
        recording_url: hasRecording ? `https://api.twilio.com/recordings/RE${callSeed.toString(16)}` : undefined,
        recording_duration: hasRecording ? duration : undefined,
        transcription: hasTranscription ?
          `Hello, this is a sample transcription for call ${i + 1}. The conversation covered various topics related to ${workflow.name.toLowerCase()}. The caller seemed satisfied with the service provided.` :
          undefined,
        summary: hasTranscription ?
          `Call summary: Customer inquiry about ${workflow.name.toLowerCase()} services. Issue was resolved successfully with high customer satisfaction.` :
          undefined,
        cost: 0.01 + (callSeed % 5) / 1000,
        metadata: {
          caller_id: direction === 'inbound' ? `+1${Math.floor(2000000000 + (callSeed % 8000000000))}` : undefined,
          caller_name: direction === 'inbound' ?
            ['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis'][callSeed % 4] :
            undefined,
          geographic_location: {
            city: ['Los Angeles', 'New York', 'Chicago', 'Houston'][callSeed % 4],
            state: ['CA', 'NY', 'IL', 'TX'][callSeed % 4],
            country: 'United States',
            timezone: ['America/Los_Angeles', 'America/New_York', 'America/Chicago', 'America/Chicago'][callSeed % 4]
          },
          call_path: status === 'answered' ? [
            'Twilio Incoming',
            'IVR Menu',
            workflow.name,
            'Call Completed'
          ] : ['Twilio Incoming', 'No Answer'],
          quality_score: 3 + (callSeed % 3), // 3-5
          network_quality: networkQualities[callSeed % networkQualities.length],
          hangup_cause: status === 'hung-up' ? 'caller-hangup' :
                       status === 'failed' ? 'network-error' : 'normal'
        },
        analysis: hasTranscription ? {
          sentiment_score: status === 'answered' ? 0.2 + (callSeed % 60) / 100 : 0,
          key_topics: [
            ['AI assistance', 'learning', 'education'],
            ['property', 'real estate', 'buying'],
            ['support', 'technical', 'help']
          ][callSeed % 3],
          action_items: status === 'answered' ? [
            'Follow up with customer in 24 hours',
            'Send additional resources via email',
            'Schedule follow-up call if needed'
          ] : [],
          outcome: status === 'answered' ? 'successful' : 'unsuccessful',
          customer_satisfaction: status === 'answered' ? 3 + (callSeed % 3) : undefined,
          agent_performance: status === 'answered' ? 4 + (callSeed % 2) : undefined
        } : undefined
      });
    }

    return records;
  }
}