import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { AuthService, User, RegisterData, LoginData, UpdateProfileData, ChangePasswordData } from '../services/authService';
import sessionService from '@/services/sessionService';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (data: LoginData) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<{ success: boolean; error?: string }>;
  changePassword: (data: ChangePasswordData) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (data: LoginData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await AuthService.login(data);

          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            // Start session monitoring
            sessionService.start();

            return { success: true };
          } else {
            // Prefer the user-friendly 'message' field over 'error' field
            const errorMessage = response.message || response.error || 'Login failed';
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
            });

            return {
              success: false,
              error: errorMessage,
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });

          return {
            success: false,
            error: errorMessage,
          };
        }
      },

      // Register action
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await AuthService.register(data);

          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            return { success: true };
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: response.error || 'Registration failed',
            });

            return {
              success: false,
              error: response.error || 'Registration failed',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });

          return {
            success: false,
            error: errorMessage,
          };
        }
      },

      // Logout action
      logout: async () => {
        set({ isLoading: true });

        try {
          // Stop session monitoring
          sessionService.stop();

          await AuthService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Get profile action
      getProfile: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await AuthService.getProfile();

          if (response.success && response.user) {
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: response.error || 'Failed to get profile',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get profile';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      // Update profile action
      updateProfile: async (data: UpdateProfileData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await AuthService.updateProfile(data);

          if (response.success && response.user) {
            set({
              user: response.user,
              isLoading: false,
              error: null,
            });

            return { success: true };
          } else {
            set({
              isLoading: false,
              error: response.error || 'Failed to update profile',
            });

            return {
              success: false,
              error: response.error || 'Failed to update profile',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
          set({
            isLoading: false,
            error: errorMessage,
          });

          return {
            success: false,
            error: errorMessage,
          };
        }
      },

      // Change password action
      changePassword: async (data: ChangePasswordData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await AuthService.changePassword(data);

          if (response.success) {
            set({
              isLoading: false,
              error: null,
            });

            return { success: true };
          } else {
            set({
              isLoading: false,
              error: response.error || 'Failed to change password',
            });

            return {
              success: false,
              error: response.error || 'Failed to change password',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
          set({
            isLoading: false,
            error: errorMessage,
          });

          return {
            success: false,
            error: errorMessage,
          };
        }
      },

      // Clear error action
      clearError: () => {
        set({ error: null });
      },

      // Initialize authentication state from localStorage
      initializeAuth: () => {
        try {
          const isAuthenticated = AuthService.isAuthenticated();
          const user = AuthService.getCurrentUser();

          if (isAuthenticated && user) {
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            // Start session monitoring for existing session
            sessionService.start();

            // Optionally refresh user profile from server
            get().getProfile();
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          console.error('Failed to initialize auth state:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },
    })),
    {
      name: 'auth-store',
    }
  )
);

// Initialize auth state when the store is created
useAuthStore.getState().initializeAuth();
