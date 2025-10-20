import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  History,
  TrendingUp,
  Download,
  Settings,
  RefreshCw,
  Zap,
  Calendar
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import CreditBalanceWidget from '@/components/credit/CreditBalanceWidget';
import UsageTrackingDisplay from '@/components/credit/UsageTrackingDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { CreditService } from '@/services/creditService';
import { CreditTransaction } from '@/types/creditTypes';
import { useCreditContext } from '@/contexts/CreditContext';

const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { refreshSummary } = useCreditContext();
  const [recentTransactions, setRecentTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTransactions = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const response = await CreditService.getCreditTransactions(user.id, { limit: 20 });
      
      if (response.success && response.data) {
        setRecentTransactions(response.data);
      } else {
        toast.error(response.error || 'Failed to load transaction history');
      }
    } catch (error) {
      toast.error('Failed to load transaction history');
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [user?.id]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      allocation: 'text-green-600',
      deduction: 'text-red-600',
      refund: 'text-blue-600',
      adjustment: 'text-yellow-600',
      expiration: 'text-gray-600'
    };
    return colors[type] || 'text-gray-600';
  };

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      allocation: 'default',
      deduction: 'destructive',
      refund: 'secondary',
      adjustment: 'outline',
      expiration: 'secondary'
    };
    return variants[type] || 'secondary';
  };

  const getServiceIcon = (serviceType: string) => {
    // This would return appropriate icons for each service type
    return <Zap className="h-4 w-4" />;
  };

  const handleExportTransactions = () => {
    toast.success('Transaction history export started. You will receive an email when ready.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Credit Dashboard"
          subtitle="Manage your credits and usage"
          showNewWorkflowButton={false}
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500">Please log in to view your credit dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Credit Dashboard"
        subtitle="Manage your credits and usage"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Credit Dashboard</h2>
                  <p className="text-sm text-gray-500">
                    Monitor your credit balance and usage across all services
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => {
                loadTransactions();
                if (refreshSummary) refreshSummary();
              }} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleExportTransactions} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Credit Balance Widget */}
        <div className="mb-8">
          <CreditBalanceWidget
            userId={user.id}
            variant="detailed"
            showUsageProjection={true}
            showAlerts={true}
            onViewDetails={() => {
              // Scroll to usage tracking section
              document.getElementById('usage-tracking')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="usage" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="usage" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Usage Tracking</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Transaction History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage" id="usage-tracking">
            <UsageTrackingDisplay
              userId={user.id}
              showExportButton={true}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Transaction History
                </CardTitle>
                <CardDescription>
                  Complete history of all credit transactions and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="text-sm">
                              {formatDate(transaction.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getTransactionTypeBadge(transaction.transaction_type)}>
                                {transaction.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getServiceIcon(transaction.service_type)}
                                <span className="text-sm capitalize">
                                  {transaction.service_type.replace('_', ' ')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {transaction.description}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${getTransactionTypeColor(transaction.transaction_type)}`}>
                              {transaction.amount > 0 ? '+' : ''}{formatNumber(transaction.amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatNumber(transaction.balance_after)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {recentTransactions.length === 0 && (
                      <div className="text-center py-8">
                        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No transaction history available</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common credit management tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => toast.info('Add credits functionality coming soon')}
              >
                <CreditCard className="h-6 w-6 mb-2" />
                Add Credits
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={handleExportTransactions}
              >
                <Download className="h-6 w-6 mb-2" />
                Export History
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => toast.info('Credit settings coming soon')}
              >
                <Settings className="h-6 w-6 mb-2" />
                Credit Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreditDashboard;
