/**
 * Analytics Configuration
 *
 * Handles multiple analytics providers:
 * - Vercel Analytics (built-in)
 * - Google Analytics 4
 * - Custom event tracking
 */

import { track as vercelTrack } from '@vercel/analytics';

// Analytics configuration
export const ANALYTICS_CONFIG = {
  enabled: process.env.NODE_ENV === 'production',
  providers: {
    vercel: !!process.env.VERCEL,
    google: !!process.env.NEXT_PUBLIC_GA_TRACKING_ID,
    custom: true,
  },
};

// Event types
export type EventType =
  | 'page_view'
  | 'quote_start'
  | 'quote_complete'
  | 'quote_step_view'
  | 'quote_conversion'
  | 'quote_progress_saved'
  | 'quote_step_error'
  | 'quote_step_valid'
  | 'zip_validated'
  | 'field_blur_validation'
  | 'user_signup'
  | 'user_signin'
  | 'user_identify'
  | 'service_booked'
  | 'payment_complete'
  | 'dashboard_view'
  | 'wellness_view'
  | 'wellness_choice_selected'
  | 'wellness_waitlist'
  | 'wellness_data_optin'
  | 'wellness_waitlist_main'
  | 'zip_check'
  | 'frequency_selected'
  | 'service_type_selected'
  | 'report_download'
  | 'referral_copy'
  | 'referral_native_share'
  | 'dashboard_tab_change'
  | 'dashboard_quick_action'
  | 'service_scheduling'
  | 'cta_insights_get_quote'
  | 'cta_insights_learn_more'
  | 'proof_cta_click'
  | 'contact_form_submit'
  | 'revenue'
  | 'error'
  | 'performance'
  | 'cta_hero_get_quote'
  | 'cta_hero_how_it_works'
  | 'cta_pricing_get_quote'
  | 'cta_pricing_bottom_get_quote'
  | 'nav_click'
  | 'cta_header_get_quote'
  | 'header_phone_call'
  | 'cta_header_signup'
  | 'cta_header_login'
  | 'cta_sticky_get_quote';

// Event properties interface
export interface EventProperties {
  [key: string]: string | number | boolean | null;
}

// Main tracking function
export function track(
  event: EventType,
  properties: EventProperties = {},
  userId?: string
) {
  if (!ANALYTICS_CONFIG.enabled) {
    console.log(`[Analytics Debug] ${event}:`, properties);
    return;
  }

  const eventData = {
    event,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      userId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    },
  };

  // Vercel Analytics
  if (ANALYTICS_CONFIG.providers.vercel) {
    try {
      // Create clean properties object without undefined values
      const cleanProperties: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(eventData.properties)) {
        if (value !== undefined && value !== null) {
          cleanProperties[key] = value as string | number | boolean | null;
        }
      }
      vercelTrack(event, cleanProperties);
    } catch (error) {
      console.warn('Vercel Analytics error:', error);
    }
  }

  // Google Analytics 4
  if (ANALYTICS_CONFIG.providers.google && typeof window !== 'undefined') {
    try {
      if (window.gtag) {
        window.gtag('event', event, {
          ...eventData.properties,
          custom_user_id: userId,
        });
      }
    } catch (error) {
      console.warn('Google Analytics error:', error);
    }
  }

  // Custom analytics endpoint (for future use)
  if (ANALYTICS_CONFIG.providers.custom && typeof window !== 'undefined') {
    try {
      // Send to custom analytics endpoint
      fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }).catch(error => {
        console.warn('Custom analytics error:', error);
      });
    } catch (error) {
      console.warn('Custom analytics error:', error);
    }
  }

  // Development logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${event}:`, eventData.properties);
  }
}

// Page view tracking
export function trackPageView(page: string, properties: EventProperties = {}) {
  track('page_view', {
    page,
    ...properties,
  });
}

// User identification
export function identifyUser(userId: string, traits: EventProperties = {}) {
  if (typeof window !== 'undefined') {
    // Store user ID for future events
    localStorage.setItem('analytics_user_id', userId);

    // Send identification event
    track('user_identify', traits, userId);
  }
}

// Revenue tracking
export function trackRevenue(
  amount: number,
  currency: string = 'USD',
  properties: EventProperties = {}
) {
  track('revenue', {
    amount,
    currency,
    ...properties,
  });
}

// Error tracking
export function trackError(
  error: Error,
  context: EventProperties = {}
) {
  track('error', {
    message: error.message,
    stack: error.stack || null,
    ...context,
  });
}

// Performance tracking
export function trackPerformance(
  metric: string,
  value: number,
  properties: EventProperties = {}
) {
  track('performance', {
    metric,
    value,
    ...properties,
  });
}

// Business-specific events
export const businessEvents = {
  // Quote funnel
  quoteStarted: (properties: EventProperties = {}) => {
    track('quote_start', properties);
  },

  quoteCompleted: (leadId: string, properties: EventProperties = {}) => {
    track('quote_complete', { leadId, ...properties });
  },

  // User lifecycle
  userSignedUp: (userId: string, method: string, properties: EventProperties = {}) => {
    track('user_signup', { method, ...properties }, userId);
  },

  userSignedIn: (userId: string, method: string, properties: EventProperties = {}) => {
    track('user_signin', { method, ...properties }, userId);
  },

  // Service lifecycle
  serviceBooked: (userId: string, serviceType: string, amount: number, properties: EventProperties = {}) => {
    track('service_booked', { serviceType, amount, ...properties }, userId);
  },

  paymentCompleted: (userId: string, amount: number, currency: string = 'USD', properties: EventProperties = {}) => {
    track('payment_complete', { amount, currency, ...properties }, userId);
    trackRevenue(amount, currency, { type: 'service_payment', ...properties });
  },

  // Product usage
  dashboardViewed: (userId: string, tab: string, properties: EventProperties = {}) => {
    track('dashboard_view', { tab, ...properties }, userId);
  },

  wellnessViewed: (userId: string, properties: EventProperties = {}) => {
    track('wellness_view', properties, userId);
  },

  contactFormSubmitted: (properties: EventProperties = {}) => {
    track('contact_form_submit', properties);
  },
};

// Google Analytics gtag type declaration
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event',
      targetId: string,
      config?: Record<string, any>
    ) => void;
  }
}