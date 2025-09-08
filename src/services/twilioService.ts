// Twilio Service for making phone calls
import { TwilioConfig } from '../types/workflowConfig';
import { CallAPI, OptimizedCallResponse } from './apiService';
import { getApiBaseUrl } from '../utils/envConfig';

export interface CallOptions {
  to: string; // Phone number to call
  from: string; // Twilio phone number
  url?: string; // TwiML URL for call instructions
  method?: 'GET' | 'POST';
  statusCallback?: string; // Webhook URL for call status updates
  statusCallbackMethod?: 'GET' | 'POST';
  record?: boolean;
  timeout?: number;
  // Workflow data for dynamic call processing
  workflowId?: string;
  nodes?: any[];
  edges?: any[];
  config?: any;
  globalPrompt?: string;
}

export interface CallResponse {
  success: boolean;
  callSid?: string;
  error?: string;
  message?: string;
}

export class TwilioService {
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  /**
   * Get the current Twilio configuration
   */
  getConfig(): TwilioConfig {
    return this.config;
  }

  /**
   * Make an optimized phone call with 150-250ms response times
   * Uses the performance-optimized backend system
   */
  async makeOptimizedCall(options: CallOptions): Promise<OptimizedCallResponse> {
    try {
      // Normalize and validate phone number
      const normalizedNumber = this.normalizePhoneNumber(options.to);
      if (!normalizedNumber) {
        return {
          success: false,
          error: 'Invalid phone number format',
          optimization: {
            enabled: false,
            trackingId: '',
            expectedLatency: 'N/A',
            features: {
              conversationRelay: false,
              predictiveCache: false,
              languageOptimization: false,
              providerFailover: false
            }
          }
        };
      }

      // Use the optimized API
      return await CallAPI.makeOptimizedCall({
        to: normalizedNumber,
        from: options.from || this.config.phoneNumber,
        workflowId: options.workflowId,
        nodes: options.nodes,
        edges: options.edges,
        globalPrompt: options.globalPrompt,
        config: options.config,
        record: options.record ?? this.config.recordCalls,
        timeout: options.timeout || this.config.callTimeout || 30,
        twilioAccountSid: this.config.accountSid,
        twilioAuthToken: this.config.authToken
      });

    } catch (error) {
      console.error('Optimized call error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        optimization: {
          enabled: false,
          trackingId: '',
          expectedLatency: 'N/A',
          features: {
            conversationRelay: false,
            predictiveCache: false,
            languageOptimization: false,
            providerFailover: false
          }
        }
      };
    }
  }

  /**
   * Make a phone call using optimized backend (150-250ms response times)
   * This method now uses the performance-optimized API by default
   */
  async makeCall(options: CallOptions): Promise<CallResponse> {
    try {
      // Normalize and validate phone number
      const normalizedNumber = this.normalizePhoneNumber(options.to);
      if (!normalizedNumber) {
        return {
          success: false,
          error: 'Invalid phone number. Please enter a valid phone number.'
        };
      }

      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        const API_BASE_URL = this.getApiBaseUrl();

        // If we have a backend API available, use real calls
        if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.startsWith('http')) {
          return this.makeRealCall(normalizedNumber, options);
        } else {
          // Demo mode - simulate a successful call for testing purposes
          return this.simulateCall(normalizedNumber, options);
        }
      }

      // Server-side implementation (would work in Node.js environment)
      return this.makeRealCall(normalizedNumber, options);
    } catch (error) {
      console.error('Twilio call error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Simulate a call for demo purposes (browser environment)
   */
  private async simulateCall(normalizedNumber: string, _options: CallOptions): Promise<CallResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate a fake call SID
    const fakeCallSid = `CA${Math.random().toString(36).substring(2, 34)}`;

    return {
      success: true,
      callSid: fakeCallSid,
      message: `Demo call initiated to ${normalizedNumber}. In production, this would make a real call using Twilio.`
    };
  }

  /**
   * Check backend health and ensure it's ready
   */
  private async checkBackendHealth(): Promise<void> {
    try {
      const API_BASE_URL = this.getApiBaseUrl();
      console.log('Checking backend health...');
      await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout for health check
      });
      console.log('Backend is healthy and ready');
    } catch (error) {
      console.warn('Backend health check failed:', error);
      throw new Error('Backend health check failed. Please ensure the backend is running.');
    }
  }

  /**
   * Check if a credential value is a placeholder
   */
  private isPlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    return value.includes('YOUR_') || value.includes('your_') || value.includes('_here') || value.trim() === '';
  }

  /**
   * Make a real call using centralized CallAPI (consistent with makeOptimizedCall)
   */
  private async makeRealCall(normalizedNumber: string, options: CallOptions): Promise<CallResponse> {
    try {
      // Check backend health before making the call
      await this.checkBackendHealth();

      // Check if we have placeholder credentials - if so, send empty values to let backend use environment variables
      const accountSid = this.isPlaceholder(this.config.accountSid) ? undefined : this.config.accountSid;
      const authToken = this.isPlaceholder(this.config.authToken) ? undefined : this.config.authToken;

      // Debug: Log what credentials we're sending
      console.log('Making call with credentials:', {
        hasAccountSid: !!accountSid,
        hasAuthToken: !!authToken,
        accountSidLength: accountSid?.length || 0,
        authTokenLength: authToken?.length || 0,
        phoneNumber: this.config.phoneNumber,
        usingPlaceholders: this.isPlaceholder(this.config.accountSid) || this.isPlaceholder(this.config.authToken)
      });

      // Use centralized CallAPI for consistency
      const result = await CallAPI.makeOptimizedCall({
        to: normalizedNumber,
        from: options.from || this.config.phoneNumber,
        record: options.record ?? this.config.recordCalls,
        timeout: options.timeout || this.config.callTimeout || 30,
        twimlUrl: options.url,
        // Include Twilio credentials - send undefined for placeholders so backend uses environment variables
        twilioAccountSid: accountSid,
        twilioAuthToken: authToken,
        // Include workflow data for dynamic call processing
        workflowId: options.workflowId,
        nodes: options.nodes,
        edges: options.edges,
        config: options.config,
        globalPrompt: options.globalPrompt
      });

      // CallAPI already handles errors and retries, so we just need to convert the response format
      if (result.success) {
        return {
          success: true,
          callSid: result.callSid,
          message: result.message || `Call initiated successfully to ${normalizedNumber}`
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to initiate call'
        };
      }

    } catch (error) {
      console.error('Backend API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to backend API'
      };
    }
  }

  /**
   * Make a traditional phone call (fallback - slower 2-3 seconds)
   * Use this only if the optimized call fails
   */
  async makeTraditionalCall(options: CallOptions): Promise<CallResponse> {
    try {
      // Normalize and validate phone number
      const normalizedNumber = this.normalizePhoneNumber(options.to);
      if (!normalizedNumber) {
        return {
          success: false,
          error: 'Invalid phone number format'
        };
      }

      // Use traditional API endpoint
      const API_BASE_URL = this.getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/api/make-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
        body: JSON.stringify({
          to: normalizedNumber,
          from: options.from || this.config.phoneNumber,
          record: options.record ?? this.config.recordCalls,
          timeout: options.timeout || this.config.callTimeout || 30,
          twimlUrl: options.url,
          twilioAccountSid: this.config.accountSid,
          twilioAuthToken: this.config.authToken,
          workflowId: options.workflowId,
          nodes: options.nodes,
          edges: options.edges,
          config: options.config,
          globalPrompt: options.globalPrompt
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          callSid: result.callSid,
          message: result.message || 'Traditional call initiated successfully (2-3s response time)'
        };
      } else {
        return {
          success: false,
          error: result.error || `HTTP ${response.status}`
        };
      }

    } catch (error) {
      console.error('Traditional call error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get the API base URL based on environment
   */
  private getApiBaseUrl(): string {
    // Check if we have a custom API URL set
    if (typeof window !== 'undefined' && (window as any).CALL_FLOW_API_URL) {
      return (window as any).CALL_FLOW_API_URL;
    }

    // Use the centralized API base URL configuration
    return getApiBaseUrl();
  }



  /**
   * Normalize phone number to E.164 format
   * Accepts various formats and converts them to E.164
   */
  private normalizePhoneNumber(phone: string): string | null {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If it's already in E.164 format, validate and return
    if (cleaned.startsWith('+') && /^\+[1-9]\d{1,14}$/.test(cleaned)) {
      return cleaned;
    }

    // Remove any leading + if present
    cleaned = cleaned.replace(/^\+/, '');

    // If it's empty after cleaning, return null
    if (!cleaned) {
      return null;
    }

    // Handle different number formats
    if (cleaned.length === 10) {
      // Assume US number if 10 digits (e.g., 1234567890)
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // US number with country code (e.g., 11234567890)
      return `+${cleaned}`;
    } else if (cleaned.length >= 7 && cleaned.length <= 15) {
      // International number without country code
      // For most international numbers, we'll assume they need a + prefix
      return `+${cleaned}`;
    }

    // If we can't determine the format, return null
    return null;
  }



  /**
   * Get call status
   */
  async getCallStatus(callSid: string): Promise<any> {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Check if we should use real API or demo mode
        const API_BASE_URL = this.getApiBaseUrl();

        if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.startsWith('http')) {
          // Use real backend API
          const response = await fetch(`${API_BASE_URL}/api/call-status?callSid=${callSid}`);

          if (response.ok) {
            const result = await response.json();
            return result.call;
          } else {
            throw new Error('Failed to get call status from backend');
          }
        } else {
          // Return mock call status for demo
          return {
            sid: callSid,
            status: 'in-progress',
            direction: 'outbound-api',
            from: this.config.phoneNumber,
            to: '+1234567890', // Mock number
            duration: null,
            price: null
          };
        }
      }

      // Server environment fallback (shouldn't be reached in browser)
      throw new Error('Server environment not supported in browser');
    } catch (error) {
      console.error('Error getting call status:', error);
      throw error;
    }
  }

  /**
   * Hang up a call
   */
  async hangupCall(callSid: string): Promise<CallResponse> {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        const API_BASE_URL = this.getApiBaseUrl();

        if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.startsWith('http')) {
          // Use real backend API
          const response = await fetch(`${API_BASE_URL}/api/end-call?callSid=${callSid}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
            const result = await response.json();
            return {
              success: result.success,
              message: result.message || 'Call ended successfully'
            };
          } else {
            const errorData = await response.json().catch(() => ({}));
            return {
              success: false,
              error: errorData.error || 'Failed to end call'
            };
          }
        } else {
          // Simulate hanging up the call for demo
          await new Promise(resolve => setTimeout(resolve, 500));
          return {
            success: true,
            message: 'Demo call ended successfully'
          };
        }
      }

      // Server environment fallback (shouldn't be reached in browser)
      return {
        success: false,
        error: 'Server environment not supported in browser'
      };
    } catch (error) {
      console.error('Error hanging up call:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Create a Twilio service instance with empty config - will be populated from environment or UI
export const defaultTwilioService = new TwilioService({
  accountSid: '',
  authToken: '',
  phoneNumber: '',
  recordCalls: true,
  callTimeout: 30
});
