import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardHeader from '@/components/layout/DashboardHeader';

const BillingCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <DashboardHeader />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Payment Cancelled</CardTitle>
            <CardDescription>
              Your payment process was cancelled
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-4">
              <XCircle className="w-12 h-12 text-amber-500" />
              <div className="text-center">
                <p className="font-semibold text-lg mb-2">
                  Payment Cancelled
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  You cancelled the payment process. No charges have been made to your account.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  You can try again anytime by selecting a plan and completing the checkout process.
                </p>
              </div>
            </div>

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

export default BillingCancel;

