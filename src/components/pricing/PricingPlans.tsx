import React, { useState } from 'react';
import { Check, Info, Zap, Loader } from 'lucide-react';
import { CreditService } from '@/services/creditService';
import { CreditPlan } from '@/types/creditTypes';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { getApiBaseUrl } from '@/utils/envConfig';

interface PricingPlansProps {
  onSelectPlan?: (planId: string, billingCycle: 'monthly' | 'annual') => void;
  currentPlanId?: string;
  useStripeCheckout?: boolean;
}

export const PricingPlans: React.FC<PricingPlansProps> = ({
  onSelectPlan,
  currentPlanId,
  useStripeCheckout = true,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { user } = useAuthStore();
  const plans = CreditService.CREDIT_PLANS;

  const formatPrice = (plan: CreditPlan): { price: string; period: string; savings?: string } => {
    if (plan.price_usd === -1) {
      return { price: 'Custom', period: 'Contact Sales' };
    }

    if (billingCycle === 'annual' && plan.annual_price_usd && plan.annual_price_usd !== -1) {
      const monthlyEquivalent = plan.annual_price_usd / 12;
      const savings = (plan.price_usd * 12) - plan.annual_price_usd;
      return {
        price: `$${Math.round(monthlyEquivalent)}`,
        period: '/month',
        savings: `Save $${Math.round(savings)}/year`,
      };
    }

    return {
      price: `$${plan.price_usd}`,
      period: '/month',
    };
  };

  const formatFeatureValue = (value: number, unit: string = ''): string => {
    if (value === -1) return 'Unlimited';
    return `${value.toLocaleString()}${unit}`;
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'enterprise') {
      toast.info('Please contact sales for enterprise pricing');
      return;
    }

    if (useStripeCheckout && user?.organization_id) {
      try {
        setIsLoading(planId);
        const apiBaseUrl = getApiBaseUrl();
        const { AuthService } = await import('@/services/authService');

        const response = await AuthService.makeAuthenticatedRequest(
          `${apiBaseUrl}/api/stripe/checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              organizationId: user.organization_id,
              planId,
              billingCycle
            })
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create checkout session');
        }

        const data = await response.json();
        if (data.data?.url) {
          window.location.href = data.data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      } catch (error) {
        console.error('Error creating checkout session:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
      } finally {
        setIsLoading(null);
      }
    } else if (onSelectPlan) {
      onSelectPlan(planId, billingCycle);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Competitive pricing with more minutes than industry leaders
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <Label htmlFor="billing-toggle" className={billingCycle === 'monthly' ? 'font-semibold' : ''}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === 'annual'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
          />
          <Label htmlFor="billing-toggle" className={billingCycle === 'annual' ? 'font-semibold' : ''}>
            Annual
          </Label>
          {billingCycle === 'annual' && (
            <Badge variant="secondary" className="ml-2">
              <Zap className="w-3 h-3 mr-1" />
              Save 20%
            </Badge>
          )}
        </div>

        {/* Credit Explanation */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-help">
                <Info className="w-4 h-4" />
                What are credits?
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                <strong>1 credit = 1 second</strong> of AI voice call time or <strong>1 chat message</strong>.
                <br />
                Example: 30,000 credits = 500 minutes of calls or 30,000 chat messages.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const pricing = formatPrice(plan);
          const isCurrentPlan = currentPlanId === plan.id;
          const isEnterprise = plan.is_enterprise;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.is_popular
                  ? 'border-primary shadow-lg scale-105'
                  : ''
              } ${isCurrentPlan ? 'border-green-500' : ''}`}
            >
              {/* Popular Badge */}
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Best Value Badge for Annual */}
              {billingCycle === 'annual' && !isEnterprise && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary" className="bg-green-500 text-white">
                    Best Value
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                {/* Pricing */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{pricing.price}</span>
                    {pricing.period !== 'Contact Sales' && (
                      <span className="text-muted-foreground">{pricing.period}</span>
                    )}
                  </div>
                  {pricing.savings && (
                    <p className="text-sm text-green-600 font-semibold mt-1">
                      {pricing.savings}
                    </p>
                  )}
                  {billingCycle === 'annual' && !isEnterprise && plan.annual_price_usd && plan.annual_price_usd !== -1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${Math.round(plan.annual_price_usd)}/year billed annually
                    </p>
                  )}
                  {!isEnterprise && plan.cost_per_minute && plan.cost_per_minute > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ${plan.cost_per_minute.toFixed(3)}/minute effective rate
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.minutes_included || 0)}</strong> minutes/month
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.features.ai_messages)}</strong> AI chat messages
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.features.ai_operators)}</strong> AI operators
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.features.concurrent_calls)}</strong> concurrent calls
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.features.campaigns_per_month)}</strong> campaigns/month
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>{formatFeatureValue(plan.features.team_members)}</strong> team members
                    </span>
                  </li>
                  {!isEnterprise && plan.features.extra_minute_cost > 0 && (
                    <li className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        ${plan.features.extra_minute_cost}/min overage
                      </span>
                    </li>
                  )}
                  {isEnterprise && (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Custom integrations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">Dedicated support</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">SLA guarantees</span>
                      </li>
                    </>
                  )}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.is_popular ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || isLoading === plan.id}
                >
                  {isLoading === plan.id ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : isEnterprise ? (
                    'Contact Sales'
                  ) : (
                    'Select Plan'
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Note */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>All plans include: Advanced analytics, API access, CRM integrations, and priority support</p>
        <p className="mt-2">Need more? Contact us for custom enterprise solutions</p>
      </div>
    </div>
  );
};

export default PricingPlans;
