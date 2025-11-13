import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Users,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Download,
  DollarSign,
  Activity,
  Zap,
  Settings,
  Loader2
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditService } from '@/services/creditService';
import { useCreditContext } from '@/contexts/CreditContext';
import { AdminCreditOverview, CreditAllocation } from '@/types/creditTypes';
import UserSelector from '@/components/admin/UserSelector';

const AdminCreditManagement: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminCreditOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isRunningResetJob, setIsRunningResetJob] = useState(false);

  // Credit allocation form state
  const [allocationForm, setAllocationForm] = useState({
    selectedUser: null as any,
    amount: '',
    reason: '',
    allocationType: 'top_up' as CreditAllocation['allocation_type']
  });

  // Get credit context to refresh balances
  const { refreshBalance, refreshSummary } = useCreditContext();

  const loadOverview = async () => {
    try {
      setIsLoading(true);
      const response = await CreditService.getAdminCreditOverview();
      if (response.success && response.data) {
        setOverview(response.data);
      } else {
        toast.error(response.error || 'Failed to load credit overview');
      }
    } catch (error) {
      toast.error('Failed to load credit overview');
      console.error('Error loading credit overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocateCredits = async () => {
    if (!allocationForm.selectedUser || !allocationForm.amount || !allocationForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsAllocating(true);

      // Import AuthService for authenticated requests
      const { AuthService } = await import('@/services/authService');

      // Use the real API endpoint for credit allocation
      const response = await AuthService.makeAuthenticatedRequest(
        '/api/admin/credits/allocate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: allocationForm.selectedUser.id,
            amount: parseInt(allocationForm.amount),
            notes: allocationForm.reason
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Successfully allocated ${allocationForm.amount} credits to ${allocationForm.selectedUser.email}`);

        // ✅ FIX: Reload overview and refresh credit context for real-time updates
        // 1. Reload admin overview
        await loadOverview();

        // 2. Refresh admin's balance in credit context (for header widget)
        await refreshBalance();
        await refreshSummary();

        // 3. Dispatch custom event so other components listening for credit updates refresh
        window.dispatchEvent(new CustomEvent('creditBalanceUpdated', {
          detail: {
            userId: allocationForm.selectedUser.id,
            amount: parseInt(allocationForm.amount),
            type: 'allocation'
          }
        }));

        setIsAllocateDialogOpen(false);
        setAllocationForm({
          selectedUser: null,
          amount: '',
          reason: '',
          allocationType: 'top_up'
        });
      } else {
        toast.error(data.error || 'Failed to allocate credits');
      }
    } catch (error) {
      toast.error('Failed to allocate credits');
      console.error('Error allocating credits:', error);
    } finally {
      setIsAllocating(false);
    }
  };

  const handleExportReport = () => {
    // Mock export functionality
    toast.success('Credit report export started. You will receive an email when ready.');
  };

  const handleRunResetJob = async () => {
    if (!confirm('Are you sure you want to run the monthly credit reset job? This will reset monthly_used to 0 and allocate new credits to all eligible users.')) {
      return;
    }

    try {
      setIsRunningResetJob(true);
      const token = localStorage.getItem('kimiya_access_token');

      const response = await fetch('/api/admin/credits/run-reset-job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Monthly reset job completed successfully! ${data.resetsProcessed} users processed.`);

        // Reload overview to show updated data
        await loadOverview();

        // Refresh credit context
        await refreshBalance();
        await refreshSummary();
      } else {
        toast.error(data.error || 'Failed to run reset job');
      }
    } catch (error) {
      toast.error('Failed to run reset job');
      console.error('Error running reset job:', error);
    } finally {
      setIsRunningResetJob(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Credit Management"
          subtitle="Manage user credits and usage tracking"
          showNewWorkflowButton={false}
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading credit overview...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Credit Management"
          subtitle="Manage user credits and usage tracking"
          showNewWorkflowButton={false}
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Credit Data</h3>
            <p className="text-gray-500 mb-4">Unable to retrieve credit management information.</p>
            <Button onClick={loadOverview}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Credit Management"
        subtitle="Manage user credits and usage tracking"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Page Header with Actions */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="h-8 w-8 text-blue-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Credit Management</h2>
                  <p className="text-sm text-gray-500">
                    Monitor and manage user credit allocations and usage
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={loadOverview} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleExportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button
                onClick={handleRunResetJob}
                variant="outline"
                disabled={isRunningResetJob}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                {isRunningResetJob ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Monthly Reset Job
                  </>
                )}
              </Button>
              <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Allocate Credits
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Allocate Credits</DialogTitle>
                    <DialogDescription>
                      Add credits to a user's account. This action will be logged and tracked.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">
                        Select User
                      </Label>
                      <div className="col-span-3">
                        <UserSelector
                          selectedUserId={allocationForm.selectedUser?.id}
                          onUserSelect={(user) => setAllocationForm(prev => ({ ...prev, selectedUser: user }))}
                          placeholder="Search and select a user..."
                          className="w-full"
                        />
                        {allocationForm.selectedUser && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-md">
                            <div className="text-sm text-gray-600">
                              <strong>Selected:</strong> {allocationForm.selectedUser.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              Current balance: {allocationForm.selectedUser.creditBalance || 0} credits
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="amount" className="text-right">
                        Credits
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter credit amount"
                        className="col-span-3"
                        value={allocationForm.amount}
                        onChange={(e) => setAllocationForm(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="allocationType" className="text-right">
                        Type
                      </Label>
                      <Select
                        value={allocationForm.allocationType}
                        onValueChange={(value) => setAllocationForm(prev => ({ ...prev, allocationType: value as CreditAllocation['allocation_type'] }))}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="initial">Initial Allocation</SelectItem>
                          <SelectItem value="top_up">Top Up</SelectItem>
                          <SelectItem value="bonus">Bonus Credits</SelectItem>
                          <SelectItem value="refund">Refund</SelectItem>
                          <SelectItem value="plan_upgrade">Plan Upgrade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reason" className="text-right">
                        Reason
                      </Label>
                      <Textarea
                        id="reason"
                        placeholder="Enter reason for allocation"
                        className="col-span-3"
                        value={allocationForm.reason}
                        onChange={(e) => setAllocationForm(prev => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAllocateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAllocateCredits}
                      disabled={isAllocating}
                    >
                      {isAllocating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Allocating...
                        </>
                      ) : (
                        'Allocate Credits'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(overview.total_users)}</div>
              <p className="text-xs text-muted-foreground">
                Active credit accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Allocated</CardTitle>
              <Zap className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(overview.total_credits_allocated)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total credits distributed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(overview.total_credits_used)}
              </div>
              <p className="text-xs text-muted-foreground">
                {((overview.total_credits_used / overview.total_credits_allocated) * 100).toFixed(1)}% utilization
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Balance Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {overview.users_with_low_balance}
              </div>
              <p className="text-xs text-muted-foreground">
                Users need attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Service</CardTitle>
              <CardDescription>Credit consumption breakdown by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(overview.usage_by_service).map(([service, credits]) => {
                  const percentage = (credits / overview.total_credits_used) * 100;
                  const serviceLabels: Record<string, { label: string; color: string }> = {
                    chat: { label: 'Chat Messages', color: 'bg-blue-500' },
                    inbound_calls: { label: 'Inbound Calls', color: 'bg-green-500' },
                    outbound_calls: { label: 'Outbound Calls', color: 'bg-purple-500' },
                    storage: { label: 'Storage', color: 'bg-yellow-500' },
                    transcription: { label: 'Transcription', color: 'bg-red-500' },
                    ai_services: { label: 'AI Services', color: 'bg-indigo-500' }
                  };

                  return (
                    <div key={service} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${serviceLabels[service]?.color || 'bg-gray-500'}`} />
                        <span className="text-sm font-medium">{serviceLabels[service]?.label || service}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{formatNumber(credits)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Users by Usage</CardTitle>
              <CardDescription>Users with highest credit consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.top_users_by_usage.map((user, index) => (
                  <div key={user.user_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{user.user_name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-500">{user.user_email || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatNumber(user.credits_used || 0)}</div>
                      <div className="text-xs text-gray-500">
                        {user.percentage_of_total != null ? `${(user.percentage_of_total as number).toFixed(1)}%` : '0%'}
                      </div>
                    </div>
                  </div>
                ))}
                {overview.top_users_by_usage.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No usage data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common credit management tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => navigate('/admin/users')}
              >
                <Users className="h-6 w-6 mb-2" />
                Manage Users
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => setIsAllocateDialogOpen(true)}
              >
                <Plus className="h-6 w-6 mb-2" />
                Allocate Credits
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => navigate('/credits')}
              >
                <Settings className="h-6 w-6 mb-2" />
                Credit Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Section */}
        {(overview.users_with_low_balance > 0 || overview.users_with_high_usage > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Credit Alerts
              </CardTitle>
              <CardDescription>Users requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.users_with_low_balance > 0 && (
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="font-medium text-red-900">Low Balance Alert</div>
                        <div className="text-sm text-red-700">
                          {overview.users_with_low_balance} users have low credit balances
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/admin/users?filter=low_balance')}>
                      View Users
                    </Button>
                  </div>
                )}

                {overview.users_with_high_usage > 0 && (
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-medium text-yellow-900">High Usage Alert</div>
                        <div className="text-sm text-yellow-700">
                          {overview.users_with_high_usage} users have high credit usage this month
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/admin/users?filter=high_usage')}>
                      View Users
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminCreditManagement;
