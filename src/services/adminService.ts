import { envConfig } from '@/utils/envConfig';
import { TokenManager } from '@/services/authService';

// Types for admin user management
export interface UserActivityMetrics {
  workflow_count: number;
  active_sessions: number;
  last_login: string | null;
  last_activity: string | null;
  total_logins: number;
  call_stats: {
    total_calls: number;
    successful_calls: number;
    total_call_duration: number;
  };
}

export interface AdminUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  activity_metrics: UserActivityMetrics;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total_count: number;
  active_count: number;
  admin_count: number;
}

export interface AdminUserDetailResponse {
  user: AdminUser;
  login_history: Array<{
    id: number;
    created_at: string;
    ip_address?: string;
    user_agent?: string;
  }>;
  recent_activity: Array<{
    id: number;
    action: string;
    created_at: string;
    details?: string;
  }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

class AdminService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = envConfig.backendUrl;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = TokenManager.getAccessToken();
      const fullUrl = `${this.baseUrl}${endpoint}`;

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Get all users with activity metrics
  async getAllUsers(): Promise<ApiResponse<AdminUsersResponse>> {
    return this.makeRequest<AdminUsersResponse>('/api/auth/admin/users');
  }

  // Get detailed user information
  async getUserDetails(userId: number): Promise<ApiResponse<AdminUserDetailResponse>> {
    return this.makeRequest<AdminUserDetailResponse>(`/api/auth/admin/users/${userId}`);
  }

  // Update user active status
  async updateUserStatus(userId: number, isActive: boolean): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>(`/api/auth/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // Delete user permanently
  async deleteUser(userId: number): Promise<ApiResponse<{ message: string; deleted_user: { id: number; email: string; role: string } }>> {
    return this.makeRequest<{ message: string; deleted_user: { id: number; email: string; role: string } }>(`/api/auth/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Utility functions for formatting user data
  static formatUserDisplayName(user: AdminUser): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    if (user.last_name) {
      return user.last_name;
    }
    return user.email.split('@')[0];
  }

  static formatUserInitials(user: AdminUser): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name.substring(0, 2).toUpperCase();
    }
    if (user.last_name) {
      return user.last_name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  }

  static formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
  }

  static formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  static formatCallStats(callStats: UserActivityMetrics['call_stats']): string {
    const { total_calls, successful_calls, total_call_duration } = callStats;
    
    if (total_calls === 0) {
      return 'No calls';
    }

    const successRate = Math.round((successful_calls / total_calls) * 100);
    const avgDuration = total_call_duration > 0 ? Math.round(total_call_duration / total_calls) : 0;

    return `${total_calls} calls (${successRate}% success, avg ${this.formatDuration(avgDuration)})`;
  }

  // Validation helpers
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidRole(role: string): role is 'user' | 'admin' {
    return role === 'user' || role === 'admin';
  }

  // Search and filter helpers
  static filterUsers(
    users: AdminUser[],
    searchTerm: string,
    roleFilter: 'all' | 'user' | 'admin',
    statusFilter: 'all' | 'active' | 'inactive'
  ): AdminUser[] {
    return users.filter(user => {
      const matchesSearch = searchTerm === '' || 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        this.formatUserDisplayName(user).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  // Sort helpers
  static sortUsers(
    users: AdminUser[],
    sortBy: 'name' | 'email' | 'role' | 'created_at' | 'last_login',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): AdminUser[] {
    return [...users].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = this.formatUserDisplayName(a).localeCompare(this.formatUserDisplayName(b));
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'last_login':
          const aLogin = a.activity_metrics.last_login ? new Date(a.activity_metrics.last_login).getTime() : 0;
          const bLogin = b.activity_metrics.last_login ? new Date(b.activity_metrics.last_login).getTime() : 0;
          comparison = aLogin - bLogin;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}

// Utility functions (exported separately to avoid issues with static methods)
export const formatUserDisplayName = (user: AdminUser): string => {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) {
    return user.first_name;
  }
  if (user.last_name) {
    return user.last_name;
  }
  return user.email.split('@')[0];
};

export const formatUserInitials = (user: AdminUser): string => {
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.first_name) {
    return user.first_name.substring(0, 2).toUpperCase();
  }
  if (user.last_name) {
    return user.last_name.substring(0, 2).toUpperCase();
  }
  return user.email.substring(0, 2).toUpperCase();
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
};

// Export both the class and an instance
export { AdminService };
export default AdminService;
