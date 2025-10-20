import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { CreditBalance, UserCreditSummary } from '@/types/creditTypes';
import { CreditService } from '@/services/creditService';
import { useAuthStore } from '@/stores/authStore';
import { AuthService } from '@/services/authService';
import { toast } from 'sonner';

interface CreditContextType {
  creditBalance: CreditBalance | null;
  creditSummary: UserCreditSummary | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  refreshBalance: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  updateBalanceAfterDeduction: (deductedAmount: number) => void;
  subscribeToBalanceUpdates: (callback: (balance: CreditBalance) => void) => () => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

interface CreditProviderProps {
  children: ReactNode;
}

export const CreditProvider: React.FC<CreditProviderProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditSummary, setCreditSummary] = useState<UserCreditSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [balanceSubscribers, setBalanceSubscribers] = useState<Set<(balance: CreditBalance) => void>>(new Set());

  // Use refs to track if data has been loaded (avoids dependency loop)
  const hasBalanceData = useRef(false);
  const hasSummaryData = useRef(false);

  // Refresh credit balance from API
  const refreshBalance = useCallback(async () => {
    // Don't fetch if user is not authenticated or still loading auth state
    if (!isAuthenticated || !user?.id || authLoading) {
      return;
    }

    // Only set loading state if this is the initial load (no existing data)
    const isInitialLoad = !hasBalanceData.current;

    try {
      if (isInitialLoad) {
        setIsLoading(true);
      }

      // Use AuthService to make authenticated request
      const response = await AuthService.makeAuthenticatedRequest('/api/credits/balance');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const balance: CreditBalance = {
            user_id: user.id,
            total_credits: data.data.totalCredits || data.data.allocatedCredits || 0,
            available_credits: data.data.currentBalance || 0,
            reserved_credits: 0,
            last_updated: new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          };

          setCreditBalance(balance);
          setLastUpdated(new Date());
          hasBalanceData.current = true; // Mark that we have data

          // Notify all subscribers
          balanceSubscribers.forEach(callback => callback(balance));
        }
      } else if (response.status === 401) {
        // Token expired or invalid - clear credit data
        console.warn('Credit balance fetch failed: Authentication required');
        setCreditBalance(null);
        setCreditSummary(null);
        hasBalanceData.current = false;
      } else {
        console.error('Failed to fetch credit balance:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.message === 'No authentication token found') {
        // User is not authenticated - clear credit data
        setCreditBalance(null);
        setCreditSummary(null);
        hasBalanceData.current = false;
      } else {
        console.error('Error refreshing credit balance:', error);
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user?.id, authLoading, balanceSubscribers]);

  // Refresh comprehensive credit summary
  const refreshSummary = useCallback(async () => {
    // Don't fetch if user is not authenticated or still loading auth state
    if (!isAuthenticated || !user?.id || authLoading) {
      return;
    }

    // Only set loading state if this is the initial load (no existing data)
    const isInitialLoad = !hasSummaryData.current;

    try {
      if (isInitialLoad) {
        setIsLoading(true);
      }

      // Fetch balance and transactions separately using existing endpoints with proper authentication
      const [balanceResponse, transactionsResponse] = await Promise.all([
        AuthService.makeAuthenticatedRequest('/api/credits/balance'),
        AuthService.makeAuthenticatedRequest('/api/credits/transactions?limit=10')
      ]);

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success && balanceData.data) {
          // Create balance object from API response
          const balance: CreditBalance = {
            user_id: user.id,
            total_credits: balanceData.data.allocatedCredits || 0,
            available_credits: balanceData.data.currentBalance || 0,
            reserved_credits: 0,
            last_updated: balanceData.data.lastUpdated || new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          };

          // Get transactions if available
          let transactions = [];
          if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            if (transactionsData.success && transactionsData.data) {
              transactions = transactionsData.data;
            }
          }

          // Create summary object
          const summary: UserCreditSummary = {
            user_id: user.id,
            user_email: user.email || '',
            user_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '',
            current_balance: balance,
            current_plan: null, // Will be populated when plan system is implemented
            usage_this_month: {
              user_id: user.id,
              period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
              period_end: new Date().toISOString(),
              total_credits_used: balanceData.data.monthlyUsed || 0,
              breakdown: {
                chat_usage: { total_credits: balanceData.data.monthlyUsed || 0, message_count: 0, session_count: 0 },
                inbound_calls: { total_credits: 0, call_count: 0, total_duration_seconds: 0 },
                outbound_calls: { total_credits: 0, call_count: 0, total_duration_seconds: 0 },
                storage: { total_credits: 0, conversation_count: 0, data_size_mb: 0 }
              }
            },
            recent_transactions: transactions,
            projected_usage: {
              estimated_monthly_usage: balanceData.data.projectedMonthlyUsage || 0,
              days_remaining_at_current_rate: Math.max(1, Math.floor((balanceData.data.currentBalance || 0) / Math.max(1, (balanceData.data.monthlyUsed || 0) / new Date().getDate()))),
              recommended_top_up: 0
            },
            alerts: {
              low_balance: (balanceData.data.currentBalance || 0) < 100,
              high_usage: (balanceData.data.monthlyUsed || 0) > 500,
              expiring_credits: false
            }
          };

          setCreditSummary(summary);
          setCreditBalance(balance);
          setLastUpdated(new Date());
          hasSummaryData.current = true; // Mark that we have data

          // Notify subscribers
          balanceSubscribers.forEach(callback => callback(balance));
        }
      } else if (balanceResponse.status === 401) {
        // Token expired or invalid - clear credit data
        console.warn('Credit summary fetch failed: Authentication required');
        setCreditBalance(null);
        setCreditSummary(null);
        hasSummaryData.current = false;
      } else {
        console.error('Failed to fetch credit balance:', balanceResponse.status, balanceResponse.statusText);
      }
    } catch (error) {
      if (error.message === 'No authentication token found') {
        // User is not authenticated - clear credit data
        setCreditBalance(null);
        setCreditSummary(null);
        hasSummaryData.current = false;
      } else {
        console.error('Error refreshing credit summary:', error);
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user?.id, user?.email, user?.first_name, user?.last_name, authLoading, balanceSubscribers]);

  // Update balance locally after credit deduction (optimistic update)
  const updateBalanceAfterDeduction = useCallback((deductedAmount: number) => {
    setCreditBalance(prevBalance => {
      if (!prevBalance) return null;
      
      const newBalance: CreditBalance = {
        ...prevBalance,
        available_credits: Math.max(0, prevBalance.available_credits - deductedAmount),
        last_updated: new Date().toISOString()
      };
      
      // Notify subscribers
      balanceSubscribers.forEach(callback => callback(newBalance));
      
      return newBalance;
    });
    
    setCreditSummary(prevSummary => {
      if (!prevSummary) return null;
      
      return {
        ...prevSummary,
        current_balance: {
          ...prevSummary.current_balance,
          available_credits: Math.max(0, prevSummary.current_balance.available_credits - deductedAmount),
          last_updated: new Date().toISOString()
        }
      };
    });
    
    setLastUpdated(new Date());
  }, [balanceSubscribers]);

  // Subscribe to balance updates
  const subscribeToBalanceUpdates = useCallback((callback: (balance: CreditBalance) => void) => {
    setBalanceSubscribers(prev => new Set([...prev, callback]));
    
    // Return unsubscribe function
    return () => {
      setBalanceSubscribers(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Auto-refresh balance when authentication state changes
  useEffect(() => {
    // Only fetch if user is authenticated and auth is not loading
    if (isAuthenticated && user?.id && !authLoading) {
      // Initial load
      refreshBalance();
      refreshSummary();
    } else if (!isAuthenticated) {
      // Clear credit data when user logs out
      setCreditBalance(null);
      setCreditSummary(null);
    }
  }, [isAuthenticated, user?.id, authLoading, refreshBalance, refreshSummary]);

  // Set up periodic refresh for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !user?.id || authLoading) return;

    // Set up periodic refresh (every 10 seconds for live updates)
    const interval = setInterval(() => {
      if (isAuthenticated && user?.id) {
        refreshBalance();
      }
    }, 10 * 1000); // 10 seconds for near real-time updates

    return () => clearInterval(interval);
  }, [isAuthenticated, user?.id, authLoading, refreshBalance]);

  // Listen for focus events to refresh balance when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && user?.id && !authLoading) {
        refreshBalance();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, user?.id, authLoading, refreshBalance]);

  // Listen for custom credit update events (e.g., after plan purchase)
  useEffect(() => {
    const handleCreditUpdate = () => {
      if (isAuthenticated && user?.id && !authLoading) {
        console.log('🔄 Credit update event received, refreshing balance...');
        refreshBalance();
        refreshSummary();
      }
    };

    // Listen for custom events
    window.addEventListener('creditBalanceUpdated', handleCreditUpdate);
    window.addEventListener('planPurchased', handleCreditUpdate);
    window.addEventListener('planChanged', handleCreditUpdate);

    return () => {
      window.removeEventListener('creditBalanceUpdated', handleCreditUpdate);
      window.removeEventListener('planPurchased', handleCreditUpdate);
      window.removeEventListener('planChanged', handleCreditUpdate);
    };
  }, [isAuthenticated, user?.id, authLoading, refreshBalance, refreshSummary]);

  const contextValue: CreditContextType = {
    creditBalance,
    creditSummary,
    isLoading,
    lastUpdated,
    refreshBalance,
    refreshSummary,
    updateBalanceAfterDeduction,
    subscribeToBalanceUpdates
  };

  return (
    <CreditContext.Provider value={contextValue}>
      {children}
    </CreditContext.Provider>
  );
};

export const useCreditContext = (): CreditContextType => {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCreditContext must be used within a CreditProvider');
  }
  return context;
};

// Hook for components that only need balance updates
export const useCreditBalance = () => {
  const { creditBalance, isLoading, lastUpdated, refreshBalance, updateBalanceAfterDeduction } = useCreditContext();
  return { creditBalance, isLoading, lastUpdated, refreshBalance, updateBalanceAfterDeduction };
};

// Hook for components that need full credit summary
export const useCreditSummary = () => {
  const { creditSummary, isLoading, lastUpdated, refreshSummary } = useCreditContext();
  return { creditSummary, isLoading, lastUpdated, refreshSummary };
};
