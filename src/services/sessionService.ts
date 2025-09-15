import { envConfig } from '@/utils/envConfig';
import { TokenManager } from '@/services/authService';

/**
 * Session Service for managing user session lifecycle
 * Handles heartbeats, offline detection, and session cleanup
 */
class SessionService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private baseUrl: string;
  private isActive: boolean = false;
  
  // Configuration
  private readonly HEARTBEAT_INTERVAL = 60 * 1000; // Send heartbeat every 60 seconds
  private readonly OFFLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes without activity = offline

  constructor() {
    this.baseUrl = envConfig.backendUrl;
    this.setupEventListeners();
  }

  /**
   * Start session monitoring
   */
  start(): void {
    if (this.isActive) {
      return; // Already active
    }

    this.isActive = true;
    this.startHeartbeat();
    console.log('🔄 Session monitoring started');
  }

  /**
   * Stop session monitoring
   */
  stop(): void {
    if (!this.isActive) {
      return; // Already stopped
    }

    this.isActive = false;
    this.stopHeartbeat();
    console.log('🔄 Session monitoring stopped');
  }

  /**
   * Start sending periodic heartbeats
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Stop sending heartbeats
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to server
   */
  private async sendHeartbeat(): Promise<boolean> {
    try {
      const token = TokenManager.getAccessToken();
      if (!token) {
        this.stop(); // No token, stop monitoring
        return false;
      }

      const response = await fetch(`${this.baseUrl}/api/auth/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('💓 Heartbeat sent successfully');
        return true;
      } else {
        console.warn('⚠️ Heartbeat failed:', response.status);
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Heartbeat error:', error);
      return false;
    }
  }

  /**
   * Mark user as offline when closing tab
   */
  private async markOffline(): Promise<void> {
    try {
      const token = TokenManager.getAccessToken();
      if (!token) {
        return;
      }

      // Use sendBeacon for reliable delivery during page unload
      const data = JSON.stringify({});
      const blob = new Blob([data], { type: 'application/json' });
      
      const success = navigator.sendBeacon(
        `${this.baseUrl}/api/auth/logout-tab`,
        blob
      );

      if (!success) {
        // Fallback to synchronous fetch if sendBeacon fails
        await fetch(`${this.baseUrl}/api/auth/logout-tab`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          keepalive: true, // Keep request alive during page unload
        });
      }

      console.log('🔒 User marked offline');
    } catch (error) {
      console.warn('⚠️ Failed to mark user offline:', error);
    }
  }

  /**
   * Setup event listeners for session management
   */
  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, reduce heartbeat frequency or stop
        console.log('📱 Page hidden, reducing session activity');
      } else {
        // Page is visible, resume normal heartbeat
        console.log('📱 Page visible, resuming session activity');
        if (this.isActive) {
          this.sendHeartbeat(); // Send immediate heartbeat when page becomes visible
        }
      }
    });

    // Handle page unload (tab close, navigation, etc.)
    window.addEventListener('beforeunload', (event) => {
      console.log('🚪 Page unloading, marking user offline');
      this.markOffline();
      this.stop();
    });

    // Handle page unload for mobile browsers
    window.addEventListener('pagehide', (event) => {
      console.log('🚪 Page hiding, marking user offline');
      this.markOffline();
      this.stop();
    });

    // Handle focus/blur events
    window.addEventListener('focus', () => {
      if (this.isActive) {
        this.sendHeartbeat(); // Send heartbeat when window gains focus
      }
    });

    window.addEventListener('blur', () => {
      // Window lost focus, but don't stop heartbeat immediately
      console.log('👁️ Window lost focus');
    });

    // Handle online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored');
      if (this.isActive) {
        this.sendHeartbeat(); // Send heartbeat when connection is restored
      }
    });

    window.addEventListener('offline', () => {
      console.log('📡 Connection lost');
      // Don't stop heartbeat, it will fail gracefully and resume when online
    });
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<any> {
    try {
      const token = TokenManager.getAccessToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${this.baseUrl}/api/auth/session-stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.data;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to get session stats:', error);
      throw error;
    }
  }

  /**
   * Check if session monitoring is active
   */
  isMonitoring(): boolean {
    return this.isActive;
  }

  /**
   * Force send heartbeat (for manual testing)
   */
  async forceHeartbeat(): Promise<boolean> {
    return await this.sendHeartbeat();
  }
}

// Create singleton instance
const sessionService = new SessionService();

export default sessionService;
export { SessionService };
