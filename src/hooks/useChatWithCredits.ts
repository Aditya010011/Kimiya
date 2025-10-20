import { useCallback } from 'react';
import { useCreditContext } from '@/contexts/CreditContext';
import { toast } from 'sonner';

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  creditError?: boolean;
  creditInfo?: {
    creditsDeducted: number;
    remainingBalance: number;
    transactionId: string;
  };
  currentBalance?: number;
  requiredCredits?: number;
  message?: string;
}

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  workflowId?: string;
  globalPrompt?: string;
  currentNodeId?: string;
  sessionId?: string;
  userId?: number;
  workflowName?: string;
  isNewSession?: boolean;
  isEndSession?: boolean;
}

export const useChatWithCredits = () => {
  const { updateBalanceAfterDeduction, refreshBalance } = useCreditContext();

  const sendChatMessage = useCallback(async (
    endpoint: '/api/chat' | '/api/chat-with-analytics',
    requestData: ChatRequest,
    options: {
      includeAuth?: boolean;
      onCreditDeducted?: (creditsDeducted: number, remainingBalance: number) => void;
      onInsufficientCredits?: (currentBalance: number, requiredCredits: number) => void;
    } = {}
  ): Promise<ChatResponse> => {
    const { includeAuth = true, onCreditDeducted, onInsufficientCredits } = options;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication header if requested
      if (includeAuth) {
        const token = localStorage.getItem('access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      const data: ChatResponse = await response.json();

      if (response.status === 402) {
        // Insufficient credits
        const errorMessage = data.message || `Insufficient credits. You have ${data.currentBalance || 0} credits but need ${data.requiredCredits || 1}.`;
        
        toast.error(errorMessage, {
          description: 'Please add more credits to continue using the service.',
          action: {
            label: 'Add Credits',
            onClick: () => {
              // Navigate to billing page or show credit purchase modal
              window.location.href = '/admin/billing';
            }
          }
        });

        if (onInsufficientCredits) {
          onInsufficientCredits(data.currentBalance || 0, data.requiredCredits || 1);
        }

        return data;
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        // Handle successful response with credit deduction
        if (data.creditInfo) {
          const { creditsDeducted, remainingBalance } = data.creditInfo;
          
          // Update local credit balance immediately (optimistic update)
          updateBalanceAfterDeduction(creditsDeducted);
          
          // Show success toast with credit info
          toast.success('Message sent successfully', {
            description: `${creditsDeducted} credit${creditsDeducted !== 1 ? 's' : ''} deducted. ${remainingBalance} credits remaining.`
          });

          if (onCreditDeducted) {
            onCreditDeducted(creditsDeducted, remainingBalance);
          }

          // Refresh balance from server after a short delay to ensure consistency
          setTimeout(() => {
            refreshBalance();
          }, 1000);
        }

        return data;
      } else {
        throw new Error(data.error || 'Chat request failed');
      }

    } catch (error) {
      console.error('Chat API error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [updateBalanceAfterDeduction, refreshBalance]);

  const sendBasicChatMessage = useCallback((
    requestData: ChatRequest,
    options?: {
      includeAuth?: boolean;
      onCreditDeducted?: (creditsDeducted: number, remainingBalance: number) => void;
      onInsufficientCredits?: (currentBalance: number, requiredCredits: number) => void;
    }
  ) => {
    return sendChatMessage('/api/chat', requestData, options);
  }, [sendChatMessage]);

  const sendAnalyticsChatMessage = useCallback((
    requestData: ChatRequest,
    options?: {
      includeAuth?: boolean;
      onCreditDeducted?: (creditsDeducted: number, remainingBalance: number) => void;
      onInsufficientCredits?: (currentBalance: number, requiredCredits: number) => void;
    }
  ) => {
    return sendChatMessage('/api/chat-with-analytics', requestData, options);
  }, [sendChatMessage]);

  return {
    sendChatMessage,
    sendBasicChatMessage,
    sendAnalyticsChatMessage
  };
};

// Utility hook for handling credit-related errors
export const useCreditErrorHandler = () => {
  const { refreshBalance } = useCreditContext();

  const handleCreditError = useCallback((error: any, response?: Response) => {
    if (response?.status === 402) {
      toast.error('Insufficient credits', {
        description: 'You need more credits to perform this action.',
        action: {
          label: 'Add Credits',
          onClick: () => {
            window.location.href = '/admin/billing';
          }
        }
      });
      return true; // Handled
    }

    if (error?.creditError) {
      toast.error(error.error || 'Credit system error', {
        description: 'There was an issue with the credit system. Please try again.',
        action: {
          label: 'Refresh',
          onClick: () => {
            refreshBalance();
          }
        }
      });
      return true; // Handled
    }

    return false; // Not handled
  }, [refreshBalance]);

  return { handleCreditError };
};
