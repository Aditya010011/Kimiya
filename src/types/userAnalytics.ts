// User Analytics Types and Interfaces

export interface UserProfile {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  profile_picture?: string;
}

export interface TwilioMetrics {
  phone_numbers_used: string[];
  total_calls_made: number;
  total_call_duration: number; // in seconds
  average_call_duration: number;
  successful_calls: number;
  failed_calls: number;
  api_requests_count: number;
  monthly_usage: {
    month: string;
    calls: number;
    duration: number;
    cost: number;
  }[];
  cost_breakdown: {
    voice_calls: number;
    sms: number;
    api_requests: number;
    total: number;
  };
}

export interface ConversationAnalytics {
  total_conversations: number;
  average_conversation_length: number;
  total_messages_sent: number;
  total_messages_received: number;
  conversation_topics: {
    topic: string;
    count: number;
    percentage: number;
  }[];
  sentiment_analysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recent_conversations: {
    id: string;
    timestamp: string;
    duration: number;
    message_count: number;
    topic: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
}

export interface CallSession {
  id: string;
  phone_number: string;
  start_time: string;
  end_time?: string;
  duration: number; // in seconds
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled';
  call_type: 'inbound' | 'outbound';
  workflow_id?: number;
  workflow_name?: string;
  transcript?: string;
  summary?: string;
  cost: number;
  recording_url?: string;
}

export interface CallManagement {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  average_duration: number;
  total_duration: number;
  call_sessions: CallSession[];
  call_trends: {
    date: string;
    calls: number;
    duration: number;
    success_rate: number;
  }[];
  peak_hours: {
    hour: number;
    call_count: number;
  }[];
}

export interface TokenUsage {
  twilio_tokens: {
    used: number;
    limit: number;
    cost: number;
    last_reset: string;
  };
  openai_tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number;
    model_usage: {
      model: string;
      tokens: number;
      cost: number;
    }[];
  };
  usage_trends: {
    date: string;
    twilio_tokens: number;
    openai_tokens: number;
    total_cost: number;
  }[];
  monthly_limits: {
    twilio_limit: number;
    openai_limit: number;
    current_usage_percentage: number;
  };
}

export interface WorkflowActivity {
  created_workflows: number;
  active_workflows: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  workflows: {
    id: number;
    name: string;
    created_at: string;
    last_executed: string;
    execution_count: number;
    success_rate: number;
    average_duration: number;
    status: 'active' | 'draft' | 'archived';
  }[];
  execution_history: {
    date: string;
    executions: number;
    success_rate: number;
    average_duration: number;
  }[];
}

export interface SystemAnalytics {
  login_patterns: {
    total_logins: number;
    unique_days: number;
    average_session_duration: number;
    login_history: {
      timestamp: string;
      ip_address: string;
      user_agent: string;
      session_duration?: number;
    }[];
    login_trends: {
      date: string;
      logins: number;
    }[];
  };
  feature_usage: {
    workflow_builder: number;
    dashboard_views: number;
    api_calls: number;
    exports: number;
    imports: number;
  };
  error_logs: {
    id: string;
    timestamp: string;
    error_type: string;
    error_message: string;
    stack_trace?: string;
    resolved: boolean;
  }[];
  performance_metrics: {
    average_page_load_time: number;
    api_response_times: {
      endpoint: string;
      average_time: number;
      slowest_time: number;
      fastest_time: number;
    }[];
    uptime_percentage: number;
  };
}

export interface UserAnalyticsData {
  user_profile: UserProfile;
  twilio_metrics: TwilioMetrics;
  conversation_analytics: ConversationAnalytics;
  call_management: CallManagement;
  token_usage: TokenUsage;
  workflow_activity: WorkflowActivity;
  system_analytics: SystemAnalytics;
  last_updated: string;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface AnalyticsFilters {
  date_range: DateRange;
  workflow_ids?: number[];
  call_types?: ('inbound' | 'outbound')[];
  status_filter?: ('completed' | 'failed' | 'in_progress' | 'cancelled')[];
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  sections: string[];
  include_charts: boolean;
  date_range: DateRange;
}

// Advanced Analytics Types
export interface CohortAnalysis {
  cohort_date: string;
  cohort_size: number;
  retention_rates: {
    day_0: number;
    day_1: number;
    day_7: number;
    day_14: number;
    day_30: number;
    day_60: number;
    day_90: number;
  };
  revenue_per_cohort: number;
  ltv: number;
}

export interface FunnelStep {
  step_name: string;
  step_order: number;
  users_entered: number;
  users_completed: number;
  conversion_rate: number;
  drop_off_rate: number;
  average_time_to_complete: number;
}

export interface FunnelAnalysis {
  funnel_name: string;
  total_users: number;
  overall_conversion_rate: number;
  steps: FunnelStep[];
  created_at: string;
  updated_at: string;
}

export interface UserJourney {
  session_id: string;
  user_id: number;
  journey_start: string;
  journey_end: string;
  total_duration: number;
  touchpoints: {
    timestamp: string;
    event_type: string;
    event_name: string;
    page_url?: string;
    duration_on_page?: number;
    metadata?: Record<string, any>;
  }[];
  conversion_events: string[];
  exit_point?: string;
}

export interface BehavioralMetrics {
  session_duration: {
    average: number;
    median: number;
    percentile_90: number;
    distribution: { range: string; count: number }[];
  };
  page_views: {
    total: number;
    unique: number;
    bounce_rate: number;
    pages_per_session: number;
  };
  engagement_score: number;
  feature_adoption: {
    feature_name: string;
    adoption_rate: number;
    first_use_time: number;
    usage_frequency: number;
  }[];
}

export interface RealtimeMetrics {
  active_users_now: number;
  active_sessions: number;
  current_calls: number;
  api_requests_per_minute: number;
  error_rate_last_hour: number;
  system_health: 'healthy' | 'warning' | 'critical';
  last_updated: string;
}

export interface CustomWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'heatmap' | 'funnel';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  data_source: string;
  refresh_interval: number;
  is_visible: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  is_default: boolean;
  widgets: CustomWidget[];
  filters: AnalyticsFilters;
  created_at: string;
  updated_at: string;
}

// Chat and Conversation Analytics Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    confidence_score?: number;
    processing_time?: number;
    tokens_used?: number;
    intent_detected?: string;
    entities_extracted?: Record<string, any>;
  };
}

export interface ChatSession {
  session_id: string;
  workflow_id: string;
  workflow_name: string;
  user_id: number;
  start_time: string;
  end_time?: string;
  duration: number; // in seconds
  message_count: number;
  status: 'active' | 'completed' | 'abandoned' | 'failed';
  outcome: 'success' | 'partial_success' | 'failure' | 'abandoned';
  completion_rate: number; // percentage of workflow completed
  messages: ChatMessage[];
  analysis: {
    sentiment_score: number; // -1 to 1
    engagement_level: 'low' | 'medium' | 'high';
    success_indicators: string[];
    failure_points: string[];
    user_satisfaction: number; // 1-5 scale
    workflow_adherence: number; // percentage
  };
  metadata: {
    user_agent?: string;
    ip_address?: string;
    session_source: 'playground' | 'api' | 'widget';
    device_type?: 'desktop' | 'mobile' | 'tablet';
  };
}

export interface ConversationAnalytics {
  total_sessions: number;
  total_messages: number;
  average_session_duration: number;
  average_messages_per_session: number;
  success_rate: number;
  abandonment_rate: number;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  engagement_metrics: {
    high_engagement: number;
    medium_engagement: number;
    low_engagement: number;
  };
  workflow_performance: {
    workflow_id: string;
    workflow_name: string;
    session_count: number;
    success_rate: number;
    average_completion_rate: number;
    average_duration: number;
  }[];
  trending_topics: {
    topic: string;
    frequency: number;
    sentiment: number;
  }[];
}

// Call Logs and Telephony Analytics Types
export interface CallRecord {
  call_id: string;
  call_sid: string; // Twilio Call SID
  user_id: number;
  workflow_id?: string;
  workflow_name?: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  status: 'answered' | 'declined' | 'busy' | 'no-answer' | 'hung-up' | 'failed' | 'cancelled';
  start_time: string;
  end_time?: string;
  duration: number; // in seconds
  recording_url?: string;
  recording_duration?: number;
  transcription?: string;
  summary?: string;
  cost: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_tokens?: number;
  metadata: {
    caller_id?: string;
    caller_name?: string;
    geographic_location?: {
      city?: string;
      state?: string;
      country?: string;
      timezone?: string;
    };
    call_path?: string[];
    quality_score?: number; // 1-5
    network_quality?: 'excellent' | 'good' | 'fair' | 'poor';
    hangup_cause?: string;
    forwarded_from?: string;
  };
  analysis?: {
    sentiment_score: number;
    key_topics: string[];
    action_items: string[];
    outcome: 'successful' | 'unsuccessful' | 'follow_up_needed';
    customer_satisfaction?: number;
    agent_performance?: number;
  };
}

export interface CallAnalytics {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_duration: number; // in seconds
  average_duration: number;
  answer_rate: number;
  cost_summary: {
    total_cost: number;
    average_cost_per_call: number;
    cost_by_direction: {
      inbound: number;
      outbound: number;
    };
  };
  call_volume_trends: {
    date: string;
    inbound_calls: number;
    outbound_calls: number;
    total_duration: number;
  }[];
  status_distribution: {
    answered: number;
    declined: number;
    busy: number;
    no_answer: number;
    hung_up: number;
    failed: number;
    cancelled: number;
  };
  geographic_distribution: {
    country: string;
    state?: string;
    call_count: number;
    total_duration: number;
  }[];
  quality_metrics: {
    average_quality_score: number;
    network_quality_distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
}

export interface AdvancedUserAnalyticsData extends UserAnalyticsData {
  cohort_analysis: CohortAnalysis[];
  funnel_analysis: FunnelAnalysis[];
  user_journeys: UserJourney[];
  behavioral_metrics: BehavioralMetrics;
  realtime_metrics: RealtimeMetrics;
  custom_dashboards: DashboardLayout[];
  // New analytics sections
  chat_analytics: ConversationAnalytics;
  chat_sessions: ChatSession[];
  call_analytics: CallAnalytics;
  call_records: CallRecord[];
  alerts: {
    id: string;
    type: 'threshold' | 'anomaly' | 'goal';
    message: string;
    severity: 'info' | 'warning' | 'error';
    timestamp: string;
    is_read: boolean;
  }[];
}