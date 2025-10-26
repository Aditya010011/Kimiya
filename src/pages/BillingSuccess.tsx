import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardHeader from '@/components/layout/DashboardHeader';

const BillingSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    // ✅ FIX 3: Increase delay to ensure webhook processing completes
    // Stripe webhooks can take 3-5 seconds to process, so we wait 5 seconds
    // before refreshing the frontend data
    const timer = setTimeout(() => {
      setStatus('success');
      setMessage('Your subscription has been activated successfully!');

      // Dispatch events to refresh subscription and credit data
      console.log('🔄 Dispatching plan change events to refresh billing data...');
      window.dispatchEvent(new CustomEvent('planChanged'));
      window.dispatchEvent(new CustomEvent('planPurchased'));
      window.dispatchEvent(new CustomEvent('creditBalanceUpdated'));
      console.log('✅ Events dispatched');
    }, 5000); // Increased from 2000ms to 5000ms (5 seconds)

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <DashboardHeader />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Payment Processing</CardTitle>
            <CardDescription>
              {status === 'loading' && 'Please wait while we process your payment...'}
              {status === 'success' && 'Payment Successful'}
              {status === 'error' && 'Payment Error'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-4">
                <Loader className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-center text-sm text-muted-foreground">
                  {message}
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <div className="text-center">
                  <p className="font-semibold text-lg mb-2">
                    {message}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your credits have been allocated and you can start using the service immediately.
                  </p>
                  <ul className="text-sm text-left space-y-2 mb-6 bg-slate-50 p-4 rounded">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Subscription activated</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Credits allocated to your account</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>Invoice sent to your email</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-center">
                  <p className="font-semibold text-lg mb-2">
                    Payment Failed
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {message}
                  </p>
                </div>
              </div>
            )}

            <div className="w-full flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/admin/billing')}
              >
                Back to Billing
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate('/')}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillingSuccess;

