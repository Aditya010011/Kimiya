import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Check,
  Star,
  Users,
  Phone,
  MessageSquare,
  Calendar,
  DollarSign,
  Settings,
  AlertTriangle,
  Download,
  RefreshCw,
  Crown,
  Building
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { AnimatedPrice } from '@/components/ui/animated-counter';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { CreditService } from '@/services/creditService';
import { OrganizationBilling, CreditPlan, PlanChangeRequest } from '@/types/creditTypes';

const AdminCreditPlans: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [billing, setBilling] = useState<OrganizationBilling | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CreditPlan | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const loadBillingData = async (isBackgroundRefresh = false) => {
    // Use organization_id from user or default for Phase 1
    const organizationId = user?.organization_id || 'org_default_123';

    try {
      // Only show full loading state on initial load, not on background refreshes
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await CreditService.getOrganizationBilling(organizationId);

      if (response.success && response.data) {
        setBilling(response.data);
      } else {
        toast.error(response.error || 'Failed to load billing information');
      }
    } catch (error) {
      toast.error('Failed to load billing information');
      console.error('Error loading billing data:', error);
    } finally {
      if (isBackgroundRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [user]);

  const formatCurrency = (amount: number) => {
    if (amount === -1) return 'Contact for pricing';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num === -1) return 'Unlimited';
    return new Intl.NumberFormat().format(num);
  };

  const formatMinutes = (credits: number) => {
    if (credits === -1) return 'Unlimited';
    return `${formatNumber(credits / 60)} mins`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handlePlanSelect = (plan: CreditPlan) => {
    if (plan.id === 'enterprise') {
      toast.info('Please contact our sales team for Enterprise plan pricing and setup.');
      return;
    }

    setSelectedPlan(plan);
    setShowPlanChangeDialog(true);
  };

  const getPlanPrice = (plan: CreditPlan) => {
    if (plan.price_usd === -1) return -1;
    return billingCycle === 'annual' ? plan.annual_price_usd : plan.price_usd;
  };

  const getAnnualSavings = (plan: CreditPlan) => {
    if (plan.price_usd === -1 || !plan.annual_price_usd) return 0;
    const monthlyTotal = plan.price_usd * 12;
    return monthlyTotal - plan.annual_price_usd;
  };

  const handlePlanChange = async () => {
    if (!selectedPlan || !billing?.current_subscription) return;

    // Use organization_id from user or default for Phase 1
    const organizationId = user?.organization_id || 'org_default_123';

    try {
      setIsChangingPlan(true);

      const planChangeRequest: PlanChangeRequest = {
        current_plan_id: billing.current_subscription.plan_id,
        new_plan_id: selectedPlan.id,
        effective_date: 'immediate',
        billing_cycle: billingCycle
      };

      const response = await CreditService.changePlan(organizationId, planChangeRequest);

      if (response.success) {
        const cycleText = billingCycle === 'annual' ? 'annual' : 'monthly';
        toast.success(`Successfully changed to ${selectedPlan.name} plan (${cycleText} billing)!`);
        setShowPlanChangeDialog(false);

        // Wait for billing data to refresh to ensure UI shows latest subscription details
        // Use background refresh to avoid hiding the UI during the update
        await loadBillingData(true);

        // Dispatch custom event to trigger credit balance refresh in navbar
        window.dispatchEvent(new CustomEvent('planChanged', {
          detail: {
            planId: selectedPlan.id,
            billingCycle,
            credits: selectedPlan.monthly_credits
          }
        }));
      } else {
        toast.error(response.error || 'Failed to change plan');
      }
    } catch (error) {
      toast.error('Failed to change plan');
      console.error('Error changing plan:', error);
    } finally {
      setIsChangingPlan(false);
    }
  };

  const getPlanIcon = (planId: string) => {
    const icons = {
      basic: <CreditCard className="h-6 w-6" />,
      professional: <Star className="h-6 w-6" />,
      enterprise: <Building className="h-6 w-6" />,
      ultimate: <Crown className="h-6 w-6" />
    };
    return icons[planId as keyof typeof icons] || <CreditCard className="h-6 w-6" />;
  };

  const getPlanColor = (planId: string) => {
    const colors = {
      basic: 'text-blue-600 bg-blue-50 border-blue-200',
      professional: 'text-purple-600 bg-purple-50 border-purple-200',
      enterprise: 'text-green-600 bg-green-50 border-green-200',
      ultimate: 'text-yellow-600 bg-yellow-50 border-yellow-200'
    };
    return colors[planId as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const isCurrentPlan = (planId: string) => {
    return billing?.current_subscription?.plan_id === planId;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Credit Plans"
          subtitle="Manage your organization's credit plan"
          showNewWorkflowButton={false}
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-500">Access denied. Admin privileges required.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          title="Credit Plans"
          subtitle="Manage your organization's credit plan"
          showNewWorkflowButton={false}
        />
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">Loading billing information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Credit Plans & Billing"
        subtitle="Manage your organization's subscription and billing"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Current Plan Status */}
        {billing?.current_subscription && (
          <Card className={`mb-8 transition-opacity duration-200 ${isRefreshing ? 'opacity-60' : 'opacity-100'}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Current Subscription
                </div>
                {isRefreshing && (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                )}
              </CardTitle>
              <CardDescription>
                Your organization's active plan and billing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Current Plan</div>
                  <div className="flex items-center space-x-2">
                    {getPlanIcon(billing.current_subscription.plan_id)}
                    <span className="text-xl font-bold">{billing.current_subscription.plan.name}</span>
                    {billing.current_subscription.plan.is_popular && (
                      <Badge variant="secondary">Popular</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(billing.current_subscription.plan.price_usd)}/month
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Billing Period</div>
                  <div className="text-lg font-medium">
                    {formatDate(billing.current_subscription.current_period_start)} - {formatDate(billing.current_subscription.current_period_end)}
                  </div>
                  <Badge variant={billing.current_subscription.status === 'active' ? 'default' : 'destructive'}>
                    {billing.current_subscription.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Next Invoice</div>
                  {billing.upcoming_invoice ? (
                    <>
                      <div className="text-lg font-medium">
                        {formatCurrency(billing.upcoming_invoice.amount_usd)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Due {formatDate(billing.upcoming_invoice.due_date)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No upcoming invoice</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plans">Available Plans</TabsTrigger>
            <TabsTrigger value="billing">Billing History</TabsTrigger>
          </TabsList>

          <TabsContent value="plans">
            {/* Available Plans */}
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
                <p className="text-lg text-gray-600">
                  Select the perfect plan for your organization's needs
                </p>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center space-x-4 mb-8">
                <Label
                  htmlFor="billing-toggle"
                  className={`text-base font-medium cursor-pointer transition-colors ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  Monthly
                </Label>
                <Switch
                  id="billing-toggle"
                  checked={billingCycle === 'annual'}
                  onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
                  className="data-[state=checked]:!bg-gray-900 data-[state=unchecked]:!bg-gray-400"
                  style={{
                    backgroundColor: billingCycle === 'annual' ? '#111827' : '#9ca3af'
                  }}
                />
                <Label
                  htmlFor="billing-toggle"
                  className={`text-base font-medium cursor-pointer transition-colors ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  Annual
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 hover:bg-green-100">
                    Save 20%
                  </Badge>
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {CreditService.CREDIT_PLANS.map((plan) => (
                  <Card 
                    key={plan.id} 
                    className={`relative ${getPlanColor(plan.id)} ${
                      isCurrentPlan(plan.id) ? 'ring-2 ring-blue-500' : ''
                    } ${plan.is_popular ? 'scale-105 shadow-lg' : ''}`}
                  >
                    {plan.is_popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-purple-600 text-white">Most Popular</Badge>
                      </div>
                    )}
                    
                    {isCurrentPlan(plan.id) && (
                      <div className="absolute -top-3 right-4">
                        <Badge className="bg-blue-600 text-white">Current Plan</Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-4">
                        {getPlanIcon(plan.id)}
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <div className="mt-4">
                        <div className="text-3xl font-bold">
                          {plan.price_usd !== -1 ? (
                            <>
                              <AnimatedPrice
                                value={getPlanPrice(plan)}
                                duration={600}
                                className="transition-all ease-out"
                              />
                              <span className="text-sm font-normal text-gray-500 transition-all duration-200 ease-in-out">
                                {billingCycle === 'annual' ? '/year' : '/month'}
                              </span>
                            </>
                          ) : (
                            <span>Contact for pricing</span>
                          )}
                        </div>
                        <div className="transition-all duration-200 ease-in-out overflow-hidden" style={{
                          maxHeight: billingCycle === 'annual' && plan.price_usd !== -1 ? '100px' : '0px',
                          opacity: billingCycle === 'annual' && plan.price_usd !== -1 ? 1 : 0
                        }}>
                          {billingCycle === 'annual' && plan.price_usd !== -1 && (
                            <>
                              <div className="text-sm text-green-600 font-medium mt-2">
                                Save <AnimatedPrice value={getAnnualSavings(plan)} duration={600} /> per year
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                <AnimatedPrice value={plan.price_usd} duration={600} />/month billed annually
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{formatMinutes(plan.monthly_credits)} included</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">{formatNumber(plan.features.ai_operators)} AI Operators</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{formatNumber(plan.features.concurrent_calls)} concurrent calls</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-purple-600" />
                          <span className="text-sm">{formatNumber(plan.features.ai_messages)} AI messages</span>
                        </div>
                        {plan.features.extra_minute_cost > 0 && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm">${plan.features.extra_minute_cost}/extra minute</span>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => handlePlanSelect(plan)}
                        disabled={isCurrentPlan(plan.id)}
                        className="w-full mt-6"
                        variant={isCurrentPlan(plan.id) ? 'outline' : 'default'}
                      >
                        {isCurrentPlan(plan.id) ? 'Current Plan' :
                         plan.id === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="billing">
            {/* Billing History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Billing History
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardTitle>
                <CardDescription>
                  Complete history of your organization's billing and payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {billing?.billing_history && billing.billing_history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Billing Period</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billing.billing_history.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {invoice.id.substring(0, 12)}...
                            </TableCell>
                            <TableCell>{invoice.plan_name}</TableCell>
                            <TableCell className="text-sm">
                              {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(invoice.amount_usd)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                invoice.status === 'paid' ? 'default' :
                                invoice.status === 'pending' ? 'secondary' :
                                invoice.status === 'failed' ? 'destructive' : 'outline'
                              }>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(invoice.created_at)}</TableCell>
                            <TableCell>
                              {invoice.invoice_url && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No billing history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Plan Change Confirmation Dialog */}
        <Dialog open={showPlanChangeDialog} onOpenChange={setShowPlanChangeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Plan Change</DialogTitle>
              <DialogDescription>
                Are you sure you want to change to the {selectedPlan?.name} plan with {billingCycle} billing?
              </DialogDescription>
            </DialogHeader>

            {selectedPlan && billing?.current_subscription && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Current Plan</div>
                    <div className="font-medium">{billing.current_subscription.plan.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(billing.current_subscription.plan.price_usd)}/month
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">New Plan</div>
                    <div className="font-medium">{selectedPlan.name}</div>
                    <div className="text-sm text-gray-500">
                      <AnimatedPrice value={getPlanPrice(selectedPlan)} duration={600} />
                      <span className="transition-all duration-200 ease-in-out">
                        {billingCycle === 'annual' ? '/year' : '/month'}
                      </span>
                    </div>
                    <div className="transition-all duration-200 ease-in-out overflow-hidden" style={{
                      maxHeight: billingCycle === 'annual' ? '40px' : '0px',
                      opacity: billingCycle === 'annual' ? 1 : 0
                    }}>
                      {billingCycle === 'annual' && (
                        <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700">
                          Save <AnimatedPrice value={getAnnualSavings(selectedPlan)} duration={600} />
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 transition-all duration-200 ease-in-out">
                  <div className="flex items-start space-x-2">
                    <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-900 mb-1">Billing Cycle</div>
                      <div className="text-sm text-blue-700">
                        {billingCycle === 'annual' ? (
                          <>
                            You will be billed <strong><AnimatedPrice value={getPlanPrice(selectedPlan)} duration={600} /></strong> annually.
                            {selectedPlan.price_usd !== -1 && (
                              <> That's <strong><AnimatedPrice value={getPlanPrice(selectedPlan) / 12} duration={600} />/month</strong> - a 20% savings!</>
                            )}
                          </>
                        ) : (
                          <>You will be billed <strong><AnimatedPrice value={getPlanPrice(selectedPlan)} duration={600} /></strong> monthly.</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The plan change will take effect immediately. You will be charged a prorated amount for the remainder of your billing cycle.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPlanChangeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePlanChange} disabled={isChangingPlan}>
                {isChangingPlan ? 'Changing Plan...' : 'Confirm Change'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCreditPlans;
