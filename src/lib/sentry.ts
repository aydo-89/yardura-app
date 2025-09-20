/**
 * Sentry Configuration for Error Tracking and Monitoring
 */

import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry if DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: process.env.NODE_ENV === "development",

    // Enable performance monitoring
    enabled: process.env.NODE_ENV === "production",

    // Set environment and release information
    environment: process.env.NODE_ENV || "development",
    release:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

    // Filter out health check endpoints from error reporting
    beforeSend: (event) => {
      // Don't send health check errors to Sentry
      if (event.request?.url?.includes("/api/health")) {
        return null;
      }
      return event;
    },
  });

  console.log("✅ Sentry error tracking initialized");
} else {
  console.log("⚠️  Sentry DSN not configured - error tracking disabled");
}

// Export Sentry for manual error reporting
export { Sentry };

// Error reporting utility functions
export const errorReporting = {
  // Report an error manually
  captureError: (error: Error, context?: any) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          component: "manual",
        },
        extra: context,
      });
    } else {
      console.error("Error captured (Sentry not configured):", error, context);
    }
  },

  // Report a message
  captureMessage: (
    message: string,
    level: Sentry.SeverityLevel = "info",
    context?: any,
  ) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureMessage(message, {
        level,
        extra: context,
      });
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, context);
    }
  },

  // Add user context
  setUser: (user: { id: string; email?: string; name?: string }) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
      });
    }
  },

  // Add tags for better error categorization
  setTag: (key: string, value: string) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.setTag(key, value);
    }
  },

  // Add extra context
  setContext: (key: string, context: any) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.setContext(key, context);
    }
  },

  // Performance monitoring (disabled - API changed)
  startTransaction: (name: string, op: string) => {
    console.log(`Transaction: ${name} (${op})`);
    return null;
  },

  // Flush pending events (useful before app shutdown)
  flush: async (timeout: number = 2000) => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await Sentry.flush(timeout);
    }
  },
};
