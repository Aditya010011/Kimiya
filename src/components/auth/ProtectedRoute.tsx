import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AuthService } from '@/services/authService';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin';
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallbackPath = '/login',
}) => {
  const location = useLocation();
  const { isAuthenticated, user, isLoading } = useAuthStore();

  // Handle session cleanup when user closes tab/browser
  useEffect(() => {
    if (!isAuthenticated) return;

    const performLogout = () => {
      const token = localStorage.getItem('kimiya_access_token');
      if (!token) return;

      // Use fetch with keepalive for reliable logout during page unload
      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          keepalive: true, // This ensures the request completes even if page unloads
        }).catch(error => {
          console.warn('Logout request failed:', error);
        });

        console.log('Session cleanup initiated');
      } catch (error) {
        console.warn('Failed to initiate logout:', error);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      performLogout();
    };

    const handleUnload = (event: Event) => {
      performLogout();
    };

    // Track if user has been away for too long (optional enhancement)
    let awayStartTime: number | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        awayStartTime = Date.now();
      } else {
        awayStartTime = null;
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login with current location
  if (!isAuthenticated) {
    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location }}
        replace
      />
    );
  }

  // If role is required and user doesn't have it, show access denied
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page. 
            {requiredRole && ` This page requires ${requiredRole} role.`}
          </p>
          <p className="text-sm text-gray-500">
            Current role: {user?.role || 'Unknown'}
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated and has required role, render children
  return <>{children}</>;
};

export default ProtectedRoute;
