import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Calendar,
  User,
  Phone,
  MessageSquare,
  Zap,
  Activity,
  Settings,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  PieChart,
  LineChart,
  Users,
  Target,
  Layers,
  Map,
  Bell,
  Filter,
  Maximize2,
  Grid3X3,
  Eye,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { UserAnalyticsService } from '@/services/userAnalyticsService';
import { AdminService, AdminUser } from '@/services/adminService';
import {
  AdvancedUserAnalyticsData,
  DateRange,
  ExportOptions,
  RealtimeMetrics
} from '@/types/userAnalytics';
import {
  RealtimeDashboard,
  AdvancedFilters,
  TimeSeriesChart,
  TrendAreaChart,
  ComparisonBarChart,
  DonutChart,
  ConversionFunnelChart,
  CohortRetentionChart,
  AnalyticsTable,
  MetricsCard
} from '@/components/analytics';
import ChatsSection from '@/components/analytics/ChatsSection';
import CallLogsSection from '@/components/analytics/CallLogsSection';
import CallLogModals from '@/components/analytics/CallLogModals';

interface UserAnalyticsDashboardProps {}

const UserAnalyticsDashboard: React.FC<UserAnalyticsDashboardProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [analyticsData, setAnalyticsData] = useState<AdvancedUserAnalyticsData | null>(null);
  const [userProfile, setUserProfile] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Services - memoize to prevent infinite re-renders
  const adminService = useMemo(() => new AdminService(), []);

  // Helper function to get user display name
  const getUserDisplayName = () => {
    if (!userProfile) return 'User';
    if (userProfile.first_name && userProfile.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return userProfile.first_name || userProfile.last_name || userProfile.email.split('@')[0];
  };

  const getUserFirstName = () => {
    if (!userProfile) return 'User';
    return userProfile.first_name || userProfile.email.split('@')[0];
  };
  const [filters, setFilters] = useState({
    date_range: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date().toISOString(),
    },
  });
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);

  // Call log modal states
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Load real user profile data
  const loadUserProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoadingUser(true);
    setUserError(null);

    try {
      console.log('👤 USER PROFILE: Loading real user data for ID:', userId);
      const response = await adminService.getUserDetails(parseInt(userId));

      if (response.success && response.data) {
        setUserProfile(response.data.user);
        console.log('✅ USER PROFILE: Real user data loaded:', response.data.user);
      } else {
        setUserError(response.error || 'User not found');
        console.error('❌ USER PROFILE: Failed to load user:', response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user profile';
      setUserError(errorMessage);
      console.error('❌ USER PROFILE: Error loading user:', err);
    } finally {
      setIsLoadingUser(false);
    }
  }, [userId, adminService]);

  const loadAnalyticsData = useCallback(async (silent = false) => {
    if (!userId) return;

    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await UserAnalyticsService.getAdvancedUserAnalytics(parseInt(userId), filters);
      setAnalyticsData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [userId, filters]);

  const loadRealtimeMetrics = useCallback(async () => {
    try {
      const metrics = await UserAnalyticsService.getRealtimeMetrics();
      setRealtimeMetrics(metrics);
    } catch (err) {
      console.error('Failed to load realtime metrics:', err);
    }
  }, []);

  useEffect(() => {
    // Load user profile first, then analytics data
    loadUserProfile();
    loadAnalyticsData();
    loadRealtimeMetrics();

    // Set up real-time updates
    const unsubscribe = UserAnalyticsService.subscribeToRealtimeUpdates((metrics) => {
      setRealtimeMetrics(metrics);
    });

    return unsubscribe;
  }, [loadUserProfile, loadAnalyticsData, loadRealtimeMetrics]);

  const handleExport = async (format: 'pdf' | 'csv' | 'json') => {
    if (!analyticsData) return;

    setIsExporting(true);
    try {
      const exportOptions: ExportOptions = {
        format,
        sections: ['user_profile', 'twilio_metrics', 'call_management', 'token_usage', 'workflow_activity', 'system_analytics'],
        include_charts: true,
        date_range: {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString()
        }
      };

      const blob = await UserAnalyticsService.exportUserAnalytics(parseInt(userId!), exportOptions);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_analytics_${userId}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to export analytics data');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Call log modal handlers
  const handleViewTranscription = (callRecord: any) => {
    setSelectedCall(callRecord);
    setTranscriptionModalOpen(true);
  };

  const handleViewSummary = (callRecord: any) => {
    setSelectedCall(callRecord);
    setSummaryModalOpen(true);
  };

  const handlePlayRecording = (callRecord: any) => {
    setSelectedCall(callRecord);
    setRecordingModalOpen(true);
  };

  const handleViewDetails = (callRecord: any) => {
    setSelectedCall(callRecord);
    setDetailsModalOpen(true);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'inactive':
      case 'negative':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      case 'draft':
      case 'neutral':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to User Management
            </Button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
                <h3 className="text-lg font-semibold mb-2">Loading Advanced Analytics</h3>
                <p className="text-gray-600">Preparing comprehensive user insights...</p>
              </div>
            </div>

            {/* Loading Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-48 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to User Management
            </Button>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Failed to load user analytics data'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Advanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/admin/users')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to User Management
              </Button>

              {/* User Profile Section - Using Real Data */}
              {isLoadingUser ? (
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ) : userError ? (
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-4 border-red-200 shadow-lg">
                    <AvatarFallback className="bg-red-100 text-red-600 text-xl font-bold">
                      ?
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-3xl font-bold text-red-600 mb-1">User Not Found</h1>
                    <p className="text-gray-600 mb-2">{userError}</p>
                    <Badge variant="destructive">Error</Badge>
                  </div>
                </div>
              ) : userProfile ? (
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xl font-bold">
                      {userProfile.first_name?.[0] || userProfile.email[0].toUpperCase()}
                      {userProfile.last_name?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">
                      {userProfile.first_name && userProfile.last_name
                        ? `${userProfile.first_name} ${userProfile.last_name}`
                        : userProfile.first_name || userProfile.last_name || userProfile.email.split('@')[0]
                      }
                    </h1>
                    <p className="text-gray-600 mb-2">{userProfile.email}</p>
                    <p className="text-sm text-blue-600 font-medium mb-2">
                      📊 Individual User Analytics Dashboard
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={userProfile.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {userProfile.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                        {userProfile.role}
                      </Badge>
                      {realtimeMetrics && (
                        <Badge variant="outline" className="animate-pulse">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                          Live
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <AdvancedFilters
                filters={filters}
                onFiltersChange={setFilters}
              />

              <Button
                variant="outline"
                onClick={() => loadAnalyticsData(false)}
                className="flex items-center gap-2"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline"
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              {userProfile && (
                <span>Member since {formatDate(userProfile.created_at)}</span>
              )}
              <span className="text-blue-600 font-medium">
                🔍 Viewing individual user data only
              </span>
              {analyticsData && analyticsData.alerts.filter(a => !a.is_read).length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {analyticsData.alerts.filter(a => !a.is_read).length} user alerts
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>User ID: {userId}</span>
              <span>•</span>
              <span>Status:</span>
              {userProfile && (
                <Badge className={
                  userProfile.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }>
                  {userProfile.is_active ? 'Active User' : 'Inactive User'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Metrics Dashboard */}
        {realtimeMetrics && (
          <RealtimeDashboard className="mb-8" />
        )}

        {/* Advanced KPI Cards - User Specific Only */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricsCard
            title="User's Total Calls"
            value={analyticsData.twilio_metrics.total_calls_made.toLocaleString()}
            subtitle={`${analyticsData.twilio_metrics.successful_calls} successful calls by this user`}
            icon={Phone}
            trend={{
              value: 12.5,
              isPositive: true,
              label: 'vs last month'
            }}
            progress={{
              value: analyticsData.twilio_metrics.successful_calls,
              max: analyticsData.twilio_metrics.total_calls_made,
              label: 'Personal Success Rate'
            }}
          />

          <MetricsCard
            title="User's Conversations"
            value={analyticsData.conversation_analytics.total_conversations}
            subtitle={`Personal avg: ${analyticsData.conversation_analytics.average_conversation_length} min`}
            icon={MessageSquare}
            trend={{
              value: 8.3,
              isPositive: true,
              label: 'engagement up'
            }}
          />

          <MetricsCard
            title="User's Workflows"
            value={analyticsData.workflow_activity.created_workflows}
            subtitle={`${analyticsData.workflow_activity.active_workflows} active workflows`}
            icon={Settings}
            progress={{
              value: analyticsData.workflow_activity.successful_executions,
              max: analyticsData.workflow_activity.total_executions,
              label: 'Personal Success Rate'
            }}
          />

          <MetricsCard
            title="User's Total Cost"
            value={formatCurrency(analyticsData.twilio_metrics.cost_breakdown.total + analyticsData.token_usage.openai_tokens.cost)}
            subtitle="This user's monthly cost"
            icon={DollarSign}
            trend={{
              value: 15.2,
              isPositive: true,
              label: 'cost trend'
            }}
          />
        </div>

        {/* Advanced Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 h-12">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="realtime" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-time
            </TabsTrigger>
            <TabsTrigger value="cohorts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cohorts
            </TabsTrigger>
            <TabsTrigger value="funnels" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Funnels
            </TabsTrigger>
            <TabsTrigger value="journeys" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Journeys
            </TabsTrigger>
            <TabsTrigger value="chats" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chats
            </TabsTrigger>
            <TabsTrigger value="call-logs" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Logs
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alerts
              {analyticsData.alerts.filter(a => !a.is_read).length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                  {analyticsData.alerts.filter(a => !a.is_read).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Advanced Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User's Call Volume Trend */}
              <TimeSeriesChart
                title={`${getUserFirstName()}'s Call Volume Trend`}
                description="This user's daily call volume over time"
                data={analyticsData.call_management.call_trends}
                xKey="date"
                yKeys={[
                  { key: 'calls', name: 'User Calls', color: '#3b82f6' },
                  { key: 'duration', name: 'User Duration (min)', color: '#10b981' }
                ]}
                className="lg:col-span-2"
                onExport={() => toast.success('User call data exported')}
                onRefresh={() => loadAnalyticsData(true)}
              />

              {/* User's Engagement Score */}
              <MetricsCard
                title="Personal Engagement Score"
                value={analyticsData.behavioral_metrics.engagement_score}
                subtitle="Based on this user's activity patterns"
                icon={TrendingUp}
                trend={{
                  value: 5.2,
                  isPositive: true,
                  label: 'vs last week'
                }}
                className="h-fit"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User's Conversation Topics Distribution */}
              <DonutChart
                title={`${getUserFirstName()}'s Conversation Topics`}
                description="Distribution of this user's conversation topics"
                data={analyticsData.conversation_analytics.conversation_topics}
                dataKey="count"
                nameKey="topic"
                colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
                onExport={() => toast.success('User conversation data exported')}
              />

              {/* User's Feature Adoption */}
              <ComparisonBarChart
                title={`${getUserFirstName()}'s Feature Usage`}
                description="This user's adoption rates across different features"
                data={analyticsData.behavioral_metrics.feature_adoption}
                xKey="feature_name"
                yKey="adoption_rate"
                color="#10b981"
                onExport={() => toast.success('User feature data exported')}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User's Session Duration Distribution */}
              <ComparisonBarChart
                title={`${analyticsData.user_profile.first_name}'s Session Duration`}
                description="How long this user spends in sessions"
                data={analyticsData.behavioral_metrics.session_duration.distribution}
                xKey="range"
                yKey="count"
                color="#8b5cf6"
                onExport={() => toast.success('User session data exported')}
              />

              {/* User's Token Usage Trend */}
              <TrendAreaChart
                title={`${analyticsData.user_profile.first_name}'s Token Usage Trend`}
                description="This user's daily token consumption"
                data={analyticsData.token_usage.usage_trends}
                xKey="date"
                yKey="total_cost"
                color="#f59e0b"
                className="lg:col-span-2"
                onExport={() => toast.success('User token data exported')}
              />
            </div>

            {/* User's Recent Activity Table */}
            <AnalyticsTable
              title={`${analyticsData.user_profile.first_name}'s Recent Activity`}
              description="This user's latest interactions and events"
              data={analyticsData.user_journeys.flatMap(journey =>
                journey.touchpoints.slice(0, 3).map(tp => ({
                  timestamp: tp.timestamp,
                  event: tp.event_name,
                  type: tp.event_type,
                  duration: tp.duration_on_page,
                  page: tp.page_url
                }))
              ).slice(0, 10)}
              columns={[
                { key: 'timestamp', label: 'Time', sortable: true, render: (value) => formatDate(value) },
                { key: 'event', label: 'Event', sortable: true },
                { key: 'type', label: 'Type', sortable: true, render: (value) => (
                  <Badge variant="outline">{value}</Badge>
                )},
                { key: 'duration', label: 'Duration', sortable: true, render: (value) =>
                  value ? `${Math.round(value)}s` : 'N/A'
                },
                { key: 'page', label: 'Page', sortable: false }
              ]}
              searchable={true}
              pageSize={10}
            />
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="realtime" className="space-y-6">
            {/* User Status Card */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <MetricsCard
                title="User Status"
                value={realtimeMetrics?.active_users_now ? "Online" : "Offline"}
                subtitle={realtimeMetrics?.active_users_now ? "Currently active" : "Not currently active"}
                icon={Users}
                badge={{
                  text: realtimeMetrics?.active_users_now ? 'Live' : 'Offline',
                  variant: realtimeMetrics?.active_users_now ? 'default' : 'secondary'
                }}
              />

              <MetricsCard
                title="Active Session"
                value={realtimeMetrics?.current_session ? "Yes" : "No"}
                subtitle={realtimeMetrics?.current_session ? "Session in progress" : "No active session"}
                icon={Activity}
                badge={{
                  text: realtimeMetrics?.current_session ? 'Active' : 'Inactive',
                  variant: realtimeMetrics?.current_session ? 'default' : 'secondary'
                }}
              />

              <MetricsCard
                title="Calls in Progress"
                value={realtimeMetrics?.calls_in_progress || 0}
                subtitle="Current active calls"
                icon={Phone}
                badge={{
                  text: realtimeMetrics?.calls_in_progress ? 'In Call' : 'Available',
                  variant: realtimeMetrics?.calls_in_progress ? 'default' : 'secondary'
                }}
              />

              <MetricsCard
                title="Response Time"
                value={`${realtimeMetrics?.response_time_avg || 0}ms`}
                subtitle="User's avg API response"
                icon={Zap}
                trend={{
                  value: -5.2,
                  isPositive: true,
                  label: 'faster than avg'
                }}
              />
            </div>

            <RealtimeDashboard userId={parseInt(userId!)} />
          </TabsContent>

          {/* User's Cohort Analysis Tab */}
          <TabsContent value="cohorts" className="space-y-6">
            <CohortRetentionChart
              title={`${analyticsData.user_profile.first_name}'s Cohort Analysis`}
              description="Track this user's retention across cohorts they belong to"
              cohorts={analyticsData.cohort_analysis}
              onExport={() => toast.success('User cohort data exported')}
              onRefresh={() => loadAnalyticsData(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <MetricsCard
                title="User's LTV"
                value={formatCurrency(analyticsData.cohort_analysis.reduce((sum, c) => sum + c.ltv, 0) / analyticsData.cohort_analysis.length)}
                subtitle="This user's lifetime value"
                icon={DollarSign}
                trend={{
                  value: 8.5,
                  isPositive: true,
                  label: 'vs last quarter'
                }}
              />

              <MetricsCard
                title="User's 30-Day Retention"
                value={`${(analyticsData.cohort_analysis.reduce((sum, c) => sum + c.retention_rates.day_30, 0) / analyticsData.cohort_analysis.length).toFixed(1)}%`}
                subtitle="This user's retention rate"
                icon={Users}
                trend={{
                  value: 3.2,
                  isPositive: true,
                  label: 'improvement'
                }}
              />

              <MetricsCard
                title="Cohorts Joined"
                value={analyticsData.cohort_analysis.length.toLocaleString()}
                subtitle="Number of cohorts this user belongs to"
                icon={BarChart3}
              />
            </div>
          </TabsContent>

          {/* User's Funnel Analysis Tab */}
          <TabsContent value="funnels" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analyticsData.funnel_analysis.map((funnel, index) => (
                <ConversionFunnelChart
                  key={index}
                  title={funnel.funnel_name}
                  description={`This user's progression • ${funnel.overall_conversion_rate.toFixed(1)}% completion rate`}
                  steps={funnel.steps.map(step => ({
                    name: step.step_name,
                    value: step.users_entered,
                    conversion: step.conversion_rate
                  }))}
                  onExport={() => toast.success(`User's ${funnel.funnel_name} exported`)}
                  onRefresh={() => loadAnalyticsData(true)}
                />
              ))}
            </div>

            <AnalyticsTable
              title={`${analyticsData.user_profile.first_name}'s Funnel Performance`}
              description="This user's progression through conversion funnels"
              data={analyticsData.funnel_analysis.map(funnel => ({
                name: funnel.funnel_name,
                total_users: funnel.total_users,
                conversion_rate: funnel.overall_conversion_rate,
                created: funnel.created_at,
                updated: funnel.updated_at
              }))}
              columns={[
                { key: 'name', label: 'Funnel Name', sortable: true },
                { key: 'total_users', label: 'User Participation', sortable: true, render: (value) => value === 1 ? 'Completed' : 'Not Started' },
                { key: 'conversion_rate', label: 'User Completion Rate', sortable: true, render: (value) => (
                  <Badge variant={value >= 50 ? 'default' : value >= 25 ? 'secondary' : 'destructive'}>
                    {value.toFixed(1)}%
                  </Badge>
                )},
                { key: 'created', label: 'Created', sortable: true, render: (value) => formatDate(value) },
                { key: 'updated', label: 'Last Updated', sortable: true, render: (value) => formatDate(value) }
              ]}
            />
          </TabsContent>

          {/* User's Journey Analysis Tab */}
          <TabsContent value="journeys" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              <MetricsCard
                title="User's Avg Journey Length"
                value={`${(analyticsData.user_journeys.reduce((sum, j) => sum + j.total_duration, 0) / analyticsData.user_journeys.length / 60).toFixed(1)} min`}
                subtitle="This user's time per session"
                icon={Clock}
              />

              <MetricsCard
                title="User's Touchpoints"
                value={(analyticsData.user_journeys.reduce((sum, j) => sum + j.touchpoints.length, 0) / analyticsData.user_journeys.length).toFixed(1)}
                subtitle="Avg per user session"
                icon={Map}
              />

              <MetricsCard
                title="User's Conversion Rate"
                value={`${(analyticsData.user_journeys.filter(j => j.conversion_events.length > 0).length / analyticsData.user_journeys.length * 100).toFixed(1)}%`}
                subtitle="User sessions with conversions"
                icon={Target}
              />

              <MetricsCard
                title="User's Exit Points"
                value={new Set(analyticsData.user_journeys.map(j => j.exit_point)).size}
                subtitle="User's unique exit locations"
                icon={AlertCircle}
              />
            </div>

            <AnalyticsTable
              title={`${analyticsData.user_profile.first_name}'s Journey Details`}
              description="This user's individual session journeys"
              data={analyticsData.user_journeys.map(journey => ({
                session_id: journey.session_id,
                start_time: journey.journey_start,
                duration: journey.total_duration,
                touchpoints: journey.touchpoints.length,
                conversions: journey.conversion_events.length,
                exit_point: journey.exit_point
              }))}
              columns={[
                { key: 'session_id', label: 'Session ID', sortable: true },
                { key: 'start_time', label: 'Start Time', sortable: true, render: (value) => formatDate(value) },
                { key: 'duration', label: 'Duration', sortable: true, render: (value) => formatDuration(value) },
                { key: 'touchpoints', label: 'Touchpoints', sortable: true },
                { key: 'conversions', label: 'Conversions', sortable: true, render: (value) => (
                  <Badge variant={value > 0 ? 'default' : 'secondary'}>
                    {value}
                  </Badge>
                )},
                { key: 'exit_point', label: 'Exit Point', sortable: false }
              ]}
              searchable={true}
              pageSize={15}
            />
          </TabsContent>

          {/* Chats Tab */}
          <TabsContent value="chats" className="space-y-6">
            <ChatsSection
              userName={userProfile ?
                (userProfile.first_name && userProfile.last_name
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : userProfile.first_name || userProfile.last_name || userProfile.email.split('@')[0]
                ) : 'User'
              }
              userId={userId ? parseInt(userId) : undefined}
            />
          </TabsContent>

          {/* Call Logs Tab */}
          <TabsContent value="call-logs" className="space-y-6">
            <CallLogsSection
              callAnalytics={analyticsData.call_analytics}
              callRecords={analyticsData.call_records}
              userName={userProfile ?
                (userProfile.first_name && userProfile.last_name
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : userProfile.first_name || userProfile.last_name || userProfile.email.split('@')[0]
                ) : 'User'
              }
              onRefresh={() => loadAnalyticsData(true)}
              onViewTranscription={handleViewTranscription}
              onViewSummary={handleViewSummary}
              onPlayRecording={handlePlayRecording}
              onViewDetails={handleViewDetails}
            />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="space-y-4">
              {analyticsData.alerts.map((alert) => (
                <Alert key={alert.id} variant={alert.severity === 'error' ? 'destructive' : 'default'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formatDate(alert.timestamp)} • Type: {alert.type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.severity === 'error' ? 'destructive' : alert.severity === 'warning' ? 'secondary' : 'default'}>
                        {alert.severity}
                      </Badge>
                      {!alert.is_read && (
                        <Badge variant="outline">New</Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Call Log Modals */}
      <CallLogModals
        selectedCall={selectedCall}
        transcriptionModalOpen={transcriptionModalOpen}
        summaryModalOpen={summaryModalOpen}
        recordingModalOpen={recordingModalOpen}
        detailsModalOpen={detailsModalOpen}
        onCloseTranscription={() => setTranscriptionModalOpen(false)}
        onCloseSummary={() => setSummaryModalOpen(false)}
        onCloseRecording={() => setRecordingModalOpen(false)}
        onCloseDetails={() => setDetailsModalOpen(false)}
      />
    </div>
  );
};

export default UserAnalyticsDashboard;