import { getApiBaseUrl } from '@/utils/envConfig';
import { AuthService } from '@/services/authService';

export class StripeClientService {
  private static baseUrl = getApiBaseUrl();

  /**
   * Create a Stripe checkout session
   * @param organizationId - Organization ID
   * @param planId - Plan ID (starter, professional, business, enterprise)
   * @param billingCycle - Billing cycle (monthly or annual)
   * @returns Checkout session data with URL
   */
  static async createCheckoutSession(
    organizationId: string,
    planId: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ) {
    try {
      const response = await AuthService.makeAuthenticatedRequest(
        `${this.baseUrl}/api/stripe/checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId,
            planId,
            billingCycle
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Get Stripe publishable key from environment
   * @returns Stripe publishable key
   */
  static getPublishableKey(): string {
    return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  }

  /**
   * Check if Stripe is configured
   * @returns true if Stripe is configured
   */
  static isConfigured(): boolean {
    return !!this.getPublishableKey();
  }
}

export default StripeClientService;

