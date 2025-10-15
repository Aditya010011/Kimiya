/**
 * Twilio Voice Service for Web-based Calling
 * 
 * Handles Twilio Voice SDK integration for browser-based calling
 */

import { Device } from '@twilio/voice-sdk';
import { getApiBaseUrl } from '../utils/envConfig';

export interface CallOptions {
  workflowId?: string;
  workflowName?: string;
  testScenario?: string;
}

export interface CallSession {
  sessionId: string;
  identity: string;
  workflowId: string;
  workflowName: string;
  testScenario: string;
  status: string;
  createdAt: string;
}

export interface VoiceToken {
  token: string;
  identity: string;
  workflowId: string;
  config: {
    accountSid: string;
  };
}

class TwilioVoiceService {
  private device: Device | null = null;
  private currentCall: any = null;
  private isInitialized = false;
  private token: string | null = null;
  private identity: string | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  /**
   * Initialize the Twilio Voice SDK
   */
  async initialize(identity?: string): Promise<boolean> {
    try {
      console.log('🎯 Initializing Twilio Voice SDK...');

      // Test backend connectivity first
      const API_BASE_URL = getApiBaseUrl();
      console.log('🌐 Testing backend connectivity to:', API_BASE_URL);

      try {
        const healthResponse = await fetch(`${API_BASE_URL}/api/inbound/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Backend health check:', healthData);
      } catch (healthError) {
        console.warn('⚠️ Backend health check failed:', healthError);
      }

      // Generate identity if not provided
      const userIdentity = identity || `user_${Date.now()}`;

      // Get access token from backend
      const tokenData = await this.getAccessToken(userIdentity);

      console.log('🔍 Token response from backend:', {
        success: tokenData.success,
        hasToken: !!tokenData.token,
        identity: tokenData.identity,
        tokenLength: tokenData.token ? tokenData.token.length : 0,
        config: tokenData.config
      });

      // Decode and display JWT token contents for debugging
      if (tokenData.token) {
        try {
          const tokenParts = tokenData.token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('🔑 JWT Token payload:', {
              identity: payload.grants?.identity,
              hasVoiceGrant: !!payload.grants?.voice,
              hasIncoming: !!payload.grants?.voice?.incoming,
              hasOutgoing: !!payload.grants?.voice?.outgoing,
              twimlAppSid: payload.grants?.voice?.outgoing?.application_sid,
              issuer: payload.iss,
              expiry: new Date(payload.exp * 1000).toISOString()
            });
          }
        } catch (decodeError) {
          console.warn('⚠️ Could not decode JWT token:', decodeError);
        }
      }

      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to get access token');
      }

      this.token = tokenData.token;
      this.identity = tokenData.identity;

      // Initialize Twilio Device
      console.log('🔧 Initializing Twilio Device with token...');
      this.device = new Device(this.token, {
        logLevel: 'debug',
        codecPreferences: ['opus', 'pcmu'],
        fakeLocalDTMF: true,
        enableRingingState: true,
      });

      // Set up event listeners
      this.setupDeviceEventListeners();

      // Register the device
      console.log('📱 Registering Twilio Device...');
      await this.device.register();
      console.log('✅ Device registered successfully');

      this.isInitialized = true;
      console.log('✅ Twilio Voice SDK initialized successfully');
      
      this.emit('initialized', { identity: this.identity });
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Twilio Voice SDK:', error);

      // Check for specific JWT/token errors
      if (error.message && error.message.includes('JWT')) {
        console.error('🔑 JWT Token Error - This might be a token validation issue');
        console.error('🔍 Token details:', {
          tokenExists: !!this.token,
          tokenLength: this.token ? this.token.length : 0,
          tokenStart: this.token ? this.token.substring(0, 50) + '...' : 'no token'
        });
      }

      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Get access token from backend
   */
  private async getAccessToken(identity: string): Promise<any> {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/api/inbound/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity })
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get access token:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up device event listeners
   */
  private setupDeviceEventListeners(): void {
    if (!this.device) return;

    this.device.on('registered', () => {
      console.log('📱 Device registered successfully');
      this.emit('registered');
    });

    this.device.on('unregistered', () => {
      console.log('📱 Device unregistered');
      this.emit('unregistered');
    });

    this.device.on('error', (error) => {
      console.error('📱 Device error:', error);
      this.emit('error', { error: error.message });
    });

    this.device.on('incoming', (call) => {
      console.log('📞 Incoming call received');
      this.currentCall = call;
      this.setupCallEventListeners(call);
      this.emit('incoming', { call });
    });

    this.device.on('tokenWillExpire', () => {
      console.log('🎫 Token will expire, refreshing...');
      this.refreshToken();
    });
  }

  /**
   * Set up call event listeners
   */
  private setupCallEventListeners(call: any): void {
    call.on('accept', () => {
      console.log('📞 Call accepted');
      this.emit('callAccepted', { call });
    });

    call.on('disconnect', () => {
      console.log('📞 Call disconnected');
      this.currentCall = null;
      this.emit('callDisconnected', { call });
    });

    call.on('cancel', () => {
      console.log('📞 Call cancelled');
      this.currentCall = null;
      this.emit('callCancelled', { call });
    });

    call.on('reject', () => {
      console.log('📞 Call rejected');
      this.currentCall = null;
      this.emit('callRejected', { call });
    });

    call.on('error', (error) => {
      console.error('📞 Call error:', error);
      this.emit('callError', { call, error: error.message });
    });

    call.on('warning', (name, data) => {
      console.warn('📞 Call warning:', name, data);
      this.emit('callWarning', { call, warning: name, data });
    });

    call.on('volume', (inputVolume, outputVolume) => {
      this.emit('volume', { inputVolume, outputVolume });
    });
  }

  /**
   * Make an outgoing call (for testing inbound functionality)
   */
  async makeCall(options: CallOptions = {}): Promise<boolean> {
    try {
      if (!this.device || !this.isInitialized) {
        throw new Error('Device not initialized');
      }

      console.log('📞 Making test call...', options);

      // Create web call session first
      const session = await this.createWebCallSession(options);
      
      if (!session.success) {
        throw new Error('Failed to create web call session');
      }

      // Make the call - this will redirect to our inbound handler for testing
      const call = await this.device.connect({
        params: {
          workflowId: options.workflowId || 'default-inbound',
          testScenario: options.testScenario || 'general-test',
          sessionId: session.session.sessionId
        }
      });

      this.currentCall = call;
      this.setupCallEventListeners(call);

      console.log('✅ Test call initiated');
      this.emit('callStarted', { call, session: session.session });
      
      return true;

    } catch (error) {
      console.error('❌ Failed to make call:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Create web call session
   */
  private async createWebCallSession(options: CallOptions): Promise<any> {
    try {
      const API_BASE_URL = getApiBaseUrl();
      
      const sessionData = {
        identity: this.identity,
        workflowId: options.workflowId || 'default-inbound',
        workflowName: options.workflowName || 'Default Inbound Workflow',
        testScenario: options.testScenario || 'general-test',
        browserInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/inbound/web-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to create web call session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept incoming call
   */
  acceptCall(): boolean {
    try {
      if (!this.currentCall) {
        throw new Error('No incoming call to accept');
      }

      this.currentCall.accept();
      console.log('✅ Call accepted');
      return true;

    } catch (error) {
      console.error('❌ Failed to accept call:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Reject incoming call
   */
  rejectCall(): boolean {
    try {
      if (!this.currentCall) {
        throw new Error('No incoming call to reject');
      }

      this.currentCall.reject();
      console.log('✅ Call rejected');
      return true;

    } catch (error) {
      console.error('❌ Failed to reject call:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Disconnect current call
   */
  disconnectCall(): boolean {
    try {
      if (!this.currentCall) {
        throw new Error('No active call to disconnect');
      }

      this.currentCall.disconnect();
      console.log('✅ Call disconnected');
      return true;

    } catch (error) {
      console.error('❌ Failed to disconnect call:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Mute/unmute microphone
   */
  toggleMute(): boolean {
    try {
      if (!this.currentCall) {
        throw new Error('No active call');
      }

      const isMuted = this.currentCall.isMuted();
      this.currentCall.mute(!isMuted);
      
      console.log(`🎤 Microphone ${!isMuted ? 'muted' : 'unmuted'}`);
      this.emit('muteToggled', { isMuted: !isMuted });
      
      return !isMuted;

    } catch (error) {
      console.error('❌ Failed to toggle mute:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Send DTMF tones
   */
  sendDTMF(digits: string): boolean {
    try {
      if (!this.currentCall) {
        throw new Error('No active call');
      }

      this.currentCall.sendDigits(digits);
      console.log(`📱 DTMF sent: ${digits}`);
      this.emit('dtmfSent', { digits });
      
      return true;

    } catch (error) {
      console.error('❌ Failed to send DTMF:', error);
      this.emit('error', { error: error.message });
      return false;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshToken(): Promise<void> {
    try {
      if (!this.identity) {
        throw new Error('No identity available for token refresh');
      }

      const tokenData = await this.getAccessToken(this.identity);
      
      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to refresh token');
      }

      this.token = tokenData.token;
      
      if (this.device) {
        this.device.updateToken(this.token);
        console.log('🎫 Token refreshed successfully');
        this.emit('tokenRefreshed');
      }

    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Get device status
   */
  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      isRegistered: this.device?.state === 'registered',
      hasActiveCall: !!this.currentCall,
      identity: this.identity,
      deviceState: this.device?.state || 'uninitialized'
    };
  }

  /**
   * Destroy the service and clean up
   */
  async destroy(): Promise<void> {
    try {
      if (this.currentCall) {
        this.currentCall.disconnect();
      }

      if (this.device) {
        this.device.unregister();
        this.device.destroy();
      }

      this.device = null;
      this.currentCall = null;
      this.isInitialized = false;
      this.token = null;
      this.identity = null;
      this.eventListeners.clear();

      console.log('🧹 Twilio Voice Service destroyed');

    } catch (error) {
      console.error('❌ Error destroying service:', error);
    }
  }

  /**
   * Event system
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const twilioVoiceService = new TwilioVoiceService();
export default twilioVoiceService;
