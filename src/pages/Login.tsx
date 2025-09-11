import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  // Get the intended destination from location state, default to dashboard
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    // If user is already authenticated, redirect to intended destination
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleLoginSuccess = () => {
    toast.success('Welcome back! You have been signed in successfully.');
    navigate(from, { replace: true });
  };

  const handleSwitchToRegister = () => {
    navigate('/register', { 
      state: { from: location.state?.from },
      replace: true 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 flex items-center justify-center">
                <img
                  src="/icon.png"
                  alt="Kimiya Logo"
                  className="w-12 h-12 object-contain"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={handleSwitchToRegister}
            />
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Demo credentials for testing:
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Email: admin@kimiyavoice.com | Password: Admin123!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
