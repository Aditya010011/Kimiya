import React, { useState, useEffect } from 'react';
import {
  Activity,
  MessageSquare,
  Phone,
  PhoneCall,
  Database,
  FileText,
  Brain,
  Download,
  Calendar,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditService } from '@/services/creditService';
import { UsageMetrics, CreditTransaction } from '@/types/creditTypes';

interface UsageTrackingDisplayProps {
  userId: number;
  showExportButton?: boolean;
  className?: string;
}

const UsageTrackingDisplay: React.FC<UsageTrackingDisplayProps> = ({
  userId,
  showExportButton = true,
  className = ''
}) => {
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');

  const loadUsageData = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;
      let endDate = now;

      switch (selectedPeriod) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last_7_days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const [usageResponse, transactionsResponse] = await Promise.all([
        CreditService.getUserUsageMetrics(userId, startDate.toISOString(), endDate.toISOString()),
        CreditService.getCreditTransactions(userId, { limit: 10 })
      ]);

      if (usageResponse.success && usageResponse.data) {
        setUsageMetrics(usageResponse.data);
      }

      if (transactionsResponse.success && transactionsResponse.data) {
        setRecentTransactions(transactionsResponse.data);
      }
    } catch (error) {
      toast.error('Failed to load usage data');
      console.error('Error loading usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportUsage = () => {
    // Mock export functionality
    toast.success('Usage report export started. You will receive an email when ready.');
  };

  useEffect(() => {
    loadUsageData();
  }, [userId, selectedPeriod]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getServiceIcon = (serviceType: string) => {
    const icons: Record<string, React.ReactNode> = {
      chat: <MessageSquare className="h-4 w-4" />,
      inbound_call: <Phone className="h-4 w-4" />,
      outbound_call: <PhoneCall className="h-4 w-4" />,
      storage: <Database className="h-4 w-4" />,
      transcription: <FileText className="h-4 w-4" />,
      ai_summary: <Brain className="h-4 w-4" />,
      ai_analysis: <Brain className="h-4 w-4" />,
      manual: <Zap className="h-4 w-4" />,
      system: <Activity className="h-4 w-4" />
    };
    return icons[serviceType] || <Activity className="h-4 w-4" />;
  };

  const getServiceColor = (serviceType: string) => {
    const colors: Record<string, string> = {
      chat: 'text-blue-600',
      inbound_call: 'text-green-600',
      outbound_call: 'text-purple-600',
      storage: 'text-yellow-600',
      transcription: 'text-red-600',
      ai_summary: 'text-indigo-600',
      ai_analysis: 'text-indigo-600',
      manual: 'text-gray-600',
      system: 'text-gray-600'
    };
    return colors[serviceType] || 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!usageMetrics) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Usage Data</h3>
        <p className="text-gray-500">Unable to load usage metrics for this period.</p>
      </div>
    );
  }

  const usageBreakdown = [
    {
      service: 'Chat Messages',
      icon: <MessageSquare className="h-5 w-5" />,
      credits: usageMetrics.breakdown.chat_usage.total_credits,
      details: `${formatNumber(usageMetrics.breakdown.chat_usage.message_count)} messages in ${usageMetrics.breakdown.chat_usage.session_count} sessions`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      service: 'Inbound Calls',
      icon: <Phone className="h-5 w-5" />,
      credits: usageMetrics.breakdown.inbound_calls.total_credits,
      details: `${usageMetrics.breakdown.inbound_calls.call_count} calls, ${formatDuration(usageMetrics.breakdown.inbound_calls.total_duration_seconds)}`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      service: 'Outbound Calls',
      icon: <PhoneCall className="h-5 w-5" />,
      credits: usageMetrics.breakdown.outbound_calls.total_credits,
      details: `${usageMetrics.breakdown.outbound_calls.call_count} calls, ${formatDuration(usageMetrics.breakdown.outbound_calls.total_duration_seconds)}`,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      service: 'Storage',
      icon: <Database className="h-5 w-5" />,
      credits: usageMetrics.breakdown.storage.total_credits,
      details: `${usageMetrics.breakdown.storage.conversation_count} conversations, ${usageMetrics.breakdown.storage.data_size_mb}MB`,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      service: 'Transcription',
      icon: <FileText className="h-5 w-5" />,
      credits: usageMetrics.breakdown.transcription.total_credits,
      details: `${usageMetrics.breakdown.transcription.transcription_count} transcriptions, ${formatDuration(usageMetrics.breakdown.transcription.total_duration_seconds)}`,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      service: 'AI Services',
      icon: <Brain className="h-5 w-5" />,
      credits: usageMetrics.breakdown.ai_services.summary_credits + usageMetrics.breakdown.ai_services.analysis_credits,
      details: `${usageMetrics.breakdown.ai_services.summary_count} summaries, ${usageMetrics.breakdown.ai_services.analysis_count} analyses`,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    }
  ];

  const totalCredits = usageBreakdown.reduce((sum, item) => sum + item.credits, 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Period Selection and Export */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Usage Tracking</h3>
          <p className="text-sm text-gray-500">Credit consumption breakdown by service</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          {showExportButton && (
            <Button variant="outline" size="sm" onClick={handleExportUsage}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Total Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Total Usage Summary
          </CardTitle>
          <CardDescription>
            Period: {new Date(usageMetrics.period_start).toLocaleDateString()} - {new Date(usageMetrics.period_end).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {formatNumber(usageMetrics.total_credits_used)} Credits
          </div>
          <div className="text-sm text-gray-500">
            Total consumed during selected period
          </div>
        </CardContent>
      </Card>

      {/* Usage Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usageBreakdown.map((item, index) => {
          const percentage = totalCredits > 0 ? (item.credits / totalCredits) * 100 : 0;
          
          return (
            <Card key={index} className={`border-l-4 ${item.borderColor}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <div className={item.color}>
                      {item.icon}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {percentage.toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-900">{item.service}</div>
                  <div className="text-2xl font-bold">{formatNumber(item.credits)}</div>
                  <div className="text-xs text-gray-500">{item.details}</div>
                  <Progress value={percentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default UsageTrackingDisplay;
