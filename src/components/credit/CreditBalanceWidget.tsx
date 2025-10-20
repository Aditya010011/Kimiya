import React, { useState, useEffect } from 'react';
import {
  Zap,
  AlertTriangle,
  TrendingUp,
  Clock,
  RefreshCw,
  CreditCard,
  Info,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CreditService } from '@/services/creditService';
import { UserCreditSummary } from '@/types/creditTypes';
import { useCreditContext } from '@/contexts/CreditContext';

interface CreditBalanceWidgetProps {
  userId: number;
  variant?: 'compact' | 'detailed' | 'minimal';
  showUsageProjection?: boolean;
  showAlerts?: boolean;
  onViewDetails?: () => void;
  className?: string;
}

const CreditBalanceWidget: React.FC<CreditBalanceWidgetProps> = ({
  userId,
  variant = 'detailed',
  showUsageProjection = true,
  showAlerts = true,
  onViewDetails,
  className = ''
}) => {
  const { creditSummary, isLoading, lastUpdated, refreshSummary } = useCreditContext();
  const [localCreditSummary, setLocalCreditSummary] = useState<UserCreditSummary | null>(null);

  // Use context data if available, otherwise fall back to local state for backward compatibility
  const effectiveCreditSummary = creditSummary || localCreditSummary;
  const effectiveIsLoading = isLoading;
  const effectiveLastUpdated = lastUpdated || new Date();

  const loadCreditData = async () => {
    try {
      // If context is available, use it
      if (refreshSummary) {
        await refreshSummary();
        return;
      }

      // Fallback to local loading for backward compatibility
      const response = await CreditService.getUserCreditSummary(userId);

      if (response.success && response.data) {
        setLocalCreditSummary(response.data);
      } else {
        toast.error(response.error || 'Failed to load credit information');
      }
    } catch (error) {
      toast.error('Failed to load credit information');
      console.error('Error loading credit data:', error);
    }
  };

  useEffect(() => {
    // Only load locally if context is not providing data
    if (!creditSummary) {
      loadCreditData();
    }
  }, [userId, creditSummary]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getBalanceStatus = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    
    if (percentage <= 10) {
      return { status: 'critical', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    } else if (percentage <= 25) {
      return { status: 'low', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' };
    } else if (percentage <= 50) {
      return { status: 'medium', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
    } else {
      return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
    }
  };

  // Only show loading skeleton on initial load (when there's no data yet)
  // Don't show it during background refreshes to prevent layout shifts
  if (isLoading && !effectiveCreditSummary) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!effectiveCreditSummary) {
    return (
      <Card className={`${className}`}>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            {effectiveIsLoading ? (
              <>
                <RefreshCw className="h-8 w-8 text-blue-500 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-500">Loading credit information...</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Unable to load credit information</p>
                <Button variant="outline" size="sm" onClick={loadCreditData} className="mt-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { current_balance, projected_usage, alerts, current_plan } = effectiveCreditSummary;
  const balanceStatus = getBalanceStatus(current_balance.available_credits, current_balance.total_credits);
  const usagePercentage = (current_balance.total_credits - current_balance.available_credits) / current_balance.total_credits * 100;

  // Minimal variant for compact spaces
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-3 p-3 bg-white rounded-lg border w-[240px] ${className}`}>
        <div className={`p-2 rounded-full flex-shrink-0 ${balanceStatus.bgColor}`}>
          <Zap className={`h-4 w-4 ${balanceStatus.color}`} />
        </div>
        <div className="flex-1 min-w-[140px] max-w-[140px]">
          <div className="text-sm font-medium tabular-nums text-right leading-tight">{formatNumber(current_balance.available_credits)} Credits</div>
          <div className="text-xs text-gray-500 text-right leading-tight">Available</div>
        </div>
        <div className="w-4 h-4 flex-shrink-0">
          {alerts.low_balance && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
        {onViewDetails && (
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="flex-shrink-0 p-0 h-auto">
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Compact variant for sidebars
  if (variant === 'compact') {
    return (
      <Card className={`${className}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Zap className={`h-4 w-4 ${balanceStatus.color}`} />
              <span className="text-sm font-medium">Credits</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Last updated: {effectiveLastUpdated.toLocaleTimeString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-bold tabular-nums min-w-[120px]">{formatNumber(current_balance.available_credits)}</div>
            <Progress value={(current_balance.available_credits / current_balance.total_credits) * 100} className="h-2" />
            <div className="text-xs text-gray-500 tabular-nums">
              {formatNumber(current_balance.total_credits - current_balance.available_credits)} used of {formatNumber(current_balance.total_credits)}
            </div>
          </div>

          {showAlerts && (alerts.low_balance || alerts.high_usage) && (
            <div className="mt-3 pt-3 border-t">
              {alerts.low_balance && (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">Low balance</span>
                </div>
              )}
              {alerts.high_usage && (
                <div className="flex items-center space-x-2 text-yellow-600">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs">High usage</span>
                </div>
              )}
            </div>
          )}

          {onViewDetails && (
            <Button variant="outline" size="sm" onClick={onViewDetails} className="w-full mt-3">
              View Details
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Detailed variant (default)
  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className={`h-5 w-5 ${balanceStatus.color}`} />
            <span>Credit Balance</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadCreditData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          {current_plan && (
            <span>Current Plan: <Badge variant="secondary">{current_plan.name}</Badge></span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className={`p-4 rounded-lg border-l-4 ${balanceStatus.bgColor} ${balanceStatus.borderColor}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold tabular-nums min-w-[160px]">{formatNumber(current_balance.available_credits)}</div>
            <Badge variant={balanceStatus.status === 'critical' ? 'destructive' : 'secondary'} className="flex-shrink-0">
              {balanceStatus.status === 'critical' ? 'Critical' :
               balanceStatus.status === 'low' ? 'Low' :
               balanceStatus.status === 'medium' ? 'Medium' : 'Good'}
            </Badge>
          </div>
          <div className="text-sm text-gray-600 mb-3">Available Credits</div>
          <Progress value={(current_balance.available_credits / current_balance.total_credits) * 100} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1 tabular-nums">
            <span>{formatNumber(current_balance.total_credits - current_balance.available_credits)} used</span>
            <span>{formatNumber(current_balance.total_credits)} total</span>
          </div>
        </div>

        {/* Reserved Credits */}
        {current_balance.reserved_credits > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Reserved for ongoing operations:</span>
            <span className="font-medium">{formatNumber(current_balance.reserved_credits)}</span>
          </div>
        )}

        {/* Usage Projection */}
        {showUsageProjection && projected_usage && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Usage Projection</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Estimated monthly usage:</div>
                <div className="font-medium">{formatNumber(projected_usage.estimated_monthly_usage)} credits</div>
              </div>
              <div>
                <div className="text-gray-600">Days remaining:</div>
                <div className="font-medium">{projected_usage.days_remaining_at_current_rate} days</div>
              </div>
            </div>
            {projected_usage.recommended_top_up && (
              <div className="text-xs text-blue-600">
                Recommended top-up: {formatNumber(projected_usage.recommended_top_up)} credits
              </div>
            )}
          </div>
        )}

        {/* Alerts */}
        {showAlerts && (alerts.low_balance || alerts.high_usage || alerts.expiring_credits) && (
          <div className="space-y-2">
            {alerts.low_balance && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your credit balance is running low. Consider adding more credits to avoid service interruption.
                </AlertDescription>
              </Alert>
            )}
            {alerts.high_usage && (
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  You're using credits faster than usual this month. Monitor your usage to stay within budget.
                </AlertDescription>
              </Alert>
            )}
            {alerts.expiring_credits && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Some of your credits will expire soon. Use them before they're lost.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          {onViewDetails && (
            <Button variant="outline" onClick={onViewDetails} className="flex-1">
              View Usage Details
            </Button>
          )}
          <Button variant="outline" className="flex-1">
            <CreditCard className="h-4 w-4 mr-2" />
            Add Credits
          </Button>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-400 text-center">
          Last updated: {effectiveLastUpdated.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditBalanceWidget;
