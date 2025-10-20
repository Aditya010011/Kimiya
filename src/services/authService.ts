import { getApiBaseUrl } from '../utils/envConfig';

// Authentication interfaces
export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'user' | 'admin';
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
  error?: string;
  details?: Array<{
    field: string;
    message: string;
    value: any;
  }>;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: 'user' | 'admin';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

// Token management
class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'kimiya_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'kimiya_refresh_token';
  private static readonly USER_KEY = 'kimiya_user';

  static setTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refresh_token);
  }

  static getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  static clearAll(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }
}

// Authentication API service
export class AuthService {
  private static baseUrl = getApiBaseUrl();

  /**
   * Register a new user
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Store tokens and user data
        TokenManager.setTokens(result.data.tokens);
        TokenManager.setUser(result.data.user);
      }

      return result;
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        message: 'Registration failed',
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Login user
   */
  static async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Store tokens and user data
        TokenManager.setTokens(result.data.tokens);
        TokenManager.setUser(result.data.user);
      }

      return result;
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        message: 'Login failed',
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Logout user
   */
  static async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const token = TokenManager.getAccessToken();
      
      if (token) {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Clear local storage regardless of API call success
      TokenManager.clearAll();

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local storage even if API call fails
      TokenManager.clearAll();
      return {
        success: true,
        message: 'Logged out successfully',
      };
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const token = TokenManager.getAccessToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      const response = await fetch(`${this.baseUrl}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success && result.data?.user) {
        // Update stored user data
        TokenManager.setUser(result.data.user);
        return {
          success: true,
          user: result.data.user,
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to get profile',
      };
    } catch (error) {
      console.error('Get profile failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(data: UpdateProfileData): Promise<{ success: boolean; user?: User; error?: string; details?: any[] }> {
    try {
      const token = TokenManager.getAccessToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      const response = await fetch(`${this.baseUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success && result.data?.user) {
        // Update stored user data
        TokenManager.setUser(result.data.user);
        return {
          success: true,
          user: result.data.user,
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to update profile',
        details: result.details,
      };
    } catch (error) {
      console.error('Update profile failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Change password
   */
  static async changePassword(data: ChangePasswordData): Promise<{ success: boolean; message?: string; error?: string; details?: any[] }> {
    try {
      const token = TokenManager.getAccessToken();
      
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      const response = await fetch(`${this.baseUrl}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Change password failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const token = TokenManager.getAccessToken();
    if (!token) return false;
    
    // Check if token is expired
    return !TokenManager.isTokenExpired(token);
  }

  /**
   * Get current user from local storage
   */
  static getCurrentUser(): User | null {
    return TokenManager.getUser();
  }

  /**
   * Make authenticated request
   */
  static async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = TokenManager.getAccessToken();
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }
}

// Export token manager for direct access if needed
export { TokenManager };

// Default export
export default AuthService;
