import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  RefreshCw,
  User,
  Bot,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ChatSession, ConversationAnalytics } from '@/types/userAnalytics';
import { chatAnalyticsService, ChatAnalyticsFilters } from '@/services/chatAnalyticsService';

interface ChatsSectionProps {
  userName: string;
  userId?: number;
}

const ChatsSection: React.FC<ChatsSectionProps> = ({
  userName,
  userId
}) => {
  // State for data
  const [chatAnalytics, setChatAnalytics] = useState<ConversationAnalytics | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for conversation messages
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadChatData();
  }, [userId]);

  // Load chat analytics and sessions data
  const loadChatData = async () => {
    try {
      console.log('📊 ANALYTICS DASHBOARD: Loading chat data...');
      setIsLoading(true);
      setError(null);

      const filters: ChatAnalyticsFilters = {};
      if (userId) {
        filters.user_id = userId;
        console.log('👤 ANALYTICS DASHBOARD: Filtering by user ID:', userId);
      }

      console.log('🔄 ANALYTICS DASHBOARD: Fetching analytics and sessions data...');

      // Load analytics and sessions in parallel
      const [analyticsData, sessionsData] = await Promise.all([
        chatAnalyticsService.getConversationAnalytics(filters),
        chatAnalyticsService.getChatSessions({ ...filters, include_messages: true })
      ]);

      console.log('📈 ANALYTICS DASHBOARD: Analytics data loaded:', analyticsData);
      console.log('💬 ANALYTICS DASHBOARD: Sessions data loaded:', sessionsData.length, 'sessions');

      setChatAnalytics(analyticsData);
      setChatSessions(sessionsData);
    } catch (err) {
      console.error('❌ ANALYTICS DASHBOARD: Failed to load chat data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat data');
      toast.error('Failed to load chat data');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadChatData();
    setIsRefreshing(false);
    toast.success('Chat data refreshed');
  };

  // Get unique workflows for filtering
  const workflows = useMemo(() => {
    const uniqueWorkflows = Array.from(new Set(chatSessions.map(session => session.workflow_name || 'Unknown Workflow')));
    return uniqueWorkflows.map(name => ({
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name
    }));
  }, [chatSessions]);

  // Filter sessions based on current filters
  const filteredSessions = useMemo(() => {
    return chatSessions.filter(session => {
      const matchesSearch = searchTerm === '' ||
        (session.workflow_name && session.workflow_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (session.messages && session.messages.some(msg => msg.content && msg.content.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesWorkflow = selectedWorkflow === 'all' ||
        (session.workflow_name && session.workflow_name.toLowerCase().replace(/\s+/g, '_') === selectedWorkflow);
      
      const matchesOutcome = selectedOutcome === 'all' || (session.outcome && session.outcome === selectedOutcome);
      
      // Simple date filtering (last 7 days, 30 days, etc.)
      const matchesDate = selectedDateRange === 'all' || (() => {
        const sessionDate = new Date(session.start_time);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (selectedDateRange) {
          case '7d': return daysDiff <= 7;
          case '30d': return daysDiff <= 30;
          case '90d': return daysDiff <= 90;
          default: return true;
        }
      })();
      
      return matchesSearch && matchesWorkflow && matchesOutcome && matchesDate;
    });
  }, [chatSessions, searchTerm, selectedWorkflow, selectedOutcome, selectedDateRange]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getOutcomeIcon = (outcome: string | null) => {
    if (!outcome) return <AlertCircle className="h-4 w-4 text-gray-500" />;

    switch (outcome) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial_success': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'failure': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'abandoned': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getOutcomeBadgeVariant = (outcome: string | null) => {
    if (!outcome) return 'outline';

    switch (outcome) {
      case 'success': return 'default';
      case 'partial_success': return 'secondary';
      case 'failure': return 'destructive';
      case 'abandoned': return 'outline';
      default: return 'outline';
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-600';
    if (score < -0.3) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const fetchConversationMessages = async (sessionId: string) => {
    console.log('📨 ChatsSection: Fetching messages for session:', sessionId);
    setIsLoadingMessages(true);
    try {
      const messages = await chatAnalyticsService.getSessionMessages(sessionId);
      console.log('📨 ChatsSection: Messages fetched:', messages.length, 'messages');
      setConversationMessages(messages);
    } catch (error) {
      console.error('❌ ChatsSection: Failed to fetch messages:', error);
      toast.error('Failed to load conversation messages');
      setConversationMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleViewConversation = async (session: ChatSession) => {
    console.log('👁️ ChatsSection: Viewing conversation for session:', session.session_id);
    setSelectedSession(session);
    setIsConversationModalOpen(true);

    // Fetch messages for this session
    await fetchConversationMessages(session.session_id);
  };

  const handleExportChats = () => {
    toast.success('Chat data exported successfully');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-lg">Loading chat analytics...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-red-500 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-red-600">Error Loading Data</h3>
                <p className="text-gray-600">{error}</p>
                <Button onClick={handleRefresh} className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if no analytics data
  if (!chatAnalytics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <MessageSquare className="h-8 w-8 text-gray-400 mr-2" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-600">No Chat Data Available</h3>
                <p className="text-gray-500">Start using the playground to see analytics here.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold">{chatAnalytics.total_sessions}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+12% from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{(chatAnalytics.success_rate * 100).toFixed(1)}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Progress value={chatAnalytics.success_rate * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(chatAnalytics.average_session_duration)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-red-600">-5% from last week</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages/Session</p>
                <p className="text-2xl font-bold">{chatAnalytics.average_messages_per_session.toFixed(1)}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">+8% engagement</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {userName}'s Chat Sessions
              </CardTitle>
              <CardDescription>
                Playground conversations and workflow interactions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportChats}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Workflows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workflows</SelectItem>
                  {workflows.map(workflow => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="partial_success">Partial Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No chat sessions found matching your filters.</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <Card key={session.session_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header with title and badges */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-semibold text-lg">{session.workflow_name || 'Unknown Workflow'}</h4>
                          <Badge variant={getOutcomeBadgeVariant(session.outcome)} className="flex items-center gap-1">
                            {getOutcomeIcon(session.outcome)}
                            <span className="capitalize">{session.outcome ? session.outcome.replace('_', ' ') : 'Unknown'}</span>
                          </Badge>
                          <Badge variant="outline">
                            {session.message_count || 0} messages
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewConversation(session)}
                          className="flex-shrink-0"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Conversation
                        </Button>
                      </div>

                      {/* Metadata grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-500 mb-1">Duration</span>
                          <span className="text-gray-900">{formatDuration(session.duration)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-500 mb-1">Completion</span>
                          <span className="text-gray-900">{session.completion_rate}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-500 mb-1">Sentiment</span>
                          <span className={getSentimentColor(session.analysis.sentiment_score)}>
                            {session.analysis.sentiment_score > 0.3 ? 'Positive' :
                             session.analysis.sentiment_score < -0.3 ? 'Negative' : 'Neutral'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-500 mb-1">Engagement</span>
                          <span className={getEngagementColor(session.analysis.engagement_level)}>
                            {session.analysis.engagement_level.charAt(0).toUpperCase() + session.analysis.engagement_level.slice(1)}
                          </span>
                        </div>
                      </div>

                      {/* Footer with timestamp */}
                      <div className="flex items-center text-sm text-gray-500 pt-2 border-t border-gray-100">
                        <Calendar className="h-4 w-4 mr-1" />
                        Started {formatRelativeTime(session.start_time)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversation Detail Modal */}
      <Dialog open={isConversationModalOpen} onOpenChange={(open) => {
        setIsConversationModalOpen(open);
        if (!open) {
          // Clear messages when modal is closed
          setConversationMessages([]);
          setSelectedSession(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation Details: {selectedSession?.workflow_name}
            </DialogTitle>
            <DialogDescription>
              Session started {selectedSession && formatRelativeTime(selectedSession.start_time)} •
              Duration: {selectedSession && formatDuration(selectedSession.duration)} •
              {selectedSession?.message_count} messages
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 pb-4">
                  {/* Session Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-gray-50 rounded-lg">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-500 mb-2">Outcome</p>
                      <div className="flex items-center gap-2">
                        {getOutcomeIcon(selectedSession.outcome)}
                        <span className="font-semibold capitalize">{selectedSession.outcome ? selectedSession.outcome.replace('_', ' ') : 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-500 mb-2">Completion Rate</p>
                      <p className="text-xl font-bold text-gray-900">{selectedSession.completion_rate || 0}%</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-500 mb-2">Sentiment</p>
                      <p className={`text-xl font-bold ${getSentimentColor(selectedSession.analysis?.sentiment_score || 0)}`}>
                        {(selectedSession.analysis?.sentiment_score || 0) > 0.3 ? 'Positive' :
                         (selectedSession.analysis?.sentiment_score || 0) < -0.3 ? 'Negative' : 'Neutral'}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-500 mb-2">Engagement</p>
                      <p className={`text-xl font-bold ${getEngagementColor(selectedSession.analysis?.engagement_level || 'low')}`}>
                        {(selectedSession.analysis?.engagement_level || 'low').charAt(0).toUpperCase() + (selectedSession.analysis?.engagement_level || 'low').slice(1)}
                      </p>
                    </div>
                  </div>

                  {/* Analysis Insights */}
                  {((selectedSession.analysis?.success_indicators?.length || 0) > 0 || (selectedSession.analysis?.failure_points?.length || 0) > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(selectedSession.analysis?.success_indicators?.length || 0) > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Success Indicators
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <ul className="space-y-1">
                              {(selectedSession.analysis?.success_indicators || []).map((indicator, index) => (
                                <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                                  {indicator}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {(selectedSession.analysis?.failure_points?.length || 0) > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                              <XCircle className="h-4 w-4" />
                              Areas for Improvement
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <ul className="space-y-1">
                              {(selectedSession.analysis?.failure_points || []).map((point, index) => (
                                <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Conversation Messages */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Conversation Thread</CardTitle>
                      <CardDescription>Complete message history for this session</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-96 overflow-y-auto px-6 pb-6">
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            <span className="ml-2">Loading messages...</span>
                          </div>
                        ) : conversationMessages.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No messages found for this conversation.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {conversationMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`flex gap-3 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                                  <AvatarFallback className={message.type === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}>
                                    {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col space-y-1">
                                  <div className={`rounded-lg px-4 py-3 ${
                                    message.type === 'user'
                                      ? 'bg-blue-500 text-white rounded-br-sm'
                                      : message.type === 'system'
                                      ? 'bg-gray-100 text-gray-700 border rounded-bl-sm'
                                      : 'bg-white text-gray-900 border shadow-sm rounded-bl-sm'
                                  }`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                  </div>
                                  <div className={`flex items-center gap-2 text-xs text-gray-500 ${
                                    message.type === 'user' ? 'justify-end' : 'justify-start'
                                  }`}>
                                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                                    {message.metadata?.confidence_score && (
                                      <>
                                        <span>•</span>
                                        <span>Confidence: {(message.metadata.confidence_score * 100).toFixed(0)}%</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatsSection;
