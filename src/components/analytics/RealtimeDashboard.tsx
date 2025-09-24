import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Users,
  Phone,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { UserAnalyticsService } from '@/services/userAnalyticsService';
import { RealtimeMetrics } from '@/types/userAnalytics';

interface RealtimeDashboardProps {
  userId?: number;
  className?: string;
}

const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ userId, className }) => {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const loadRealtimeData = useCallback(async () => {
    try {
      const data = await UserAnalyticsService.getRealtimeMetrics();
      setMetrics(data);
      setLastUpdate(new Date());
      setIsConnected(true);
      setIsLoading(false);
    } catch (error) {
      setIsConnected(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealtimeData();

    // Subscribe to real-time updates
    const unsubscribe = UserAnalyticsService.subscribeToRealtimeUpdates((data) => {
      setMetrics(data);
      setLastUpdate(new Date());
      setIsConnected(true);
    });

    return unsubscribe;
  }, [loadRealtimeData]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return XCircle;
      default: return Activity;
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Real-time Analytics</h2>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load real-time data. Please check your connection.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const HealthIcon = getHealthIcon(metrics.system_health);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Real-time Analytics</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={loadRealtimeData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      {metrics.system_health !== 'healthy' && (
        <Alert variant={metrics.system_health === 'critical' ? 'destructive' : 'default'}>
          <HealthIcon className="h-4 w-4" />
          <AlertDescription>
            System health is currently {metrics.system_health}. 
            {metrics.system_health === 'critical' && ' Immediate attention required.'}
            {metrics.system_health === 'warning' && ' Monitoring recommended.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.active_users_now}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.active_sessions} active sessions
            </p>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Live
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.current_calls}</div>
            <p className="text-xs text-muted-foreground">
              Active voice calls
            </p>
            <div className="mt-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600">In Progress</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{metrics.api_requests_per_minute}</div>
            <p className="text-xs text-muted-foreground">
              Requests per minute
            </p>
            <div className="mt-2">
              <Progress value={Math.min((metrics.api_requests_per_minute / 500) * 100, 100)} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              metrics.error_rate_last_hour > 5 ? 'text-red-600' : 
              metrics.error_rate_last_hour > 2 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {metrics.error_rate_last_hour.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last hour
            </p>
            <div className="mt-2">
              {metrics.error_rate_last_hour <= 2 ? (
                <TrendingDown className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HealthIcon className={`h-5 w-5 ${getHealthColor(metrics.system_health).split(' ')[0]}`} />
            System Health Status
          </CardTitle>
          <CardDescription>
            Overall system performance and health indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={getHealthColor(metrics.system_health)}>
                  {metrics.system_health.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-600">
                  Last updated: {new Date(metrics.last_updated).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-lg font-bold text-blue-600">{metrics.active_users_now}</div>
                  <div className="text-xs text-gray-500">Active Users</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-lg font-bold text-green-600">{metrics.current_calls}</div>
                  <div className="text-xs text-gray-500">Live Calls</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-lg font-bold text-purple-600">{metrics.api_requests_per_minute}</div>
                  <div className="text-xs text-gray-500">API RPM</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className={`text-lg font-bold ${
                    metrics.error_rate_last_hour > 5 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {metrics.error_rate_last_hour.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Error Rate</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeDashboard;
