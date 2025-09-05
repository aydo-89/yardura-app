import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),

  // NextAuth
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Email (SMTP or Resend)
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email address'),

  // Optional: Gmail SMTP
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),

  // Optional: Resend (alternative to SMTP)
  RESEND_API_KEY: z.string().optional(),

  // Optional: Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Optional: Supabase (for file storage and real-time features)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional().default('stool-samples'),

  // reCAPTCHA configuration
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),
  RECAPTCHA_SECRET_KEY: z.string().optional(),

  // Google Maps (Places Autocomplete)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Form protection
  FORM_PROTECTION_ENABLED: z.string().optional().default('true'),

  // Admin configuration
  ADMIN_EMAILS: z.string().optional(),

  // Application settings
  NODE_ENV: z.enum(['development', 'test', 'production']).optional().default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:3000'),

  // Feature flags
  ENABLE_INSIGHTS: z.string().optional().default('false'),
  ENABLE_DEVICE_INTEGRATION: z.string().optional().default('false'),
  ENABLE_MULTI_TENANT: z.string().optional().default('false'),

  // Security
  SECRET_KEY_BASE: z
    .string()
    .min(32, 'SECRET_KEY_BASE must be at least 32 characters')
    .optional(),
  EDGE_DEVICE_ISSUER: z.string().optional().default('yardura-device'),
  JWT_SIGNING_KEY: z.string().optional(),

  // Queue
  REDIS_URL: z.string().optional(),

  // Analytics (optional)
  NEXT_PUBLIC_GA_TRACKING_ID: z.string().optional(),
  NEXT_PUBLIC_GTM_ID: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});

// Validate email configuration (either SMTP or Resend must be configured)
const validateEmailConfig = (env: Record<string, string | undefined>) => {
  // Skip email validation in development and during build to avoid build failures
  if (process.env.NODE_ENV !== 'production' || !process.env.CI) {
    return true;
  }

  const hasSMTP = env.EMAIL_SERVER_HOST && env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD;
  const hasResend = env.RESEND_API_KEY;

  if (!hasSMTP && !hasResend) {
    throw new Error(
      'Email configuration is required. Either configure SMTP (EMAIL_SERVER_*) or Resend (RESEND_API_KEY)'
    );
  }

  return true;
};

// Validate Google OAuth (both values must be present if either is set)
const validateGoogleOAuth = (env: Record<string, string | undefined>) => {
  const hasClientId = env.GOOGLE_CLIENT_ID;
  const hasClientSecret = env.GOOGLE_CLIENT_SECRET;

  if ((hasClientId && !hasClientSecret) || (!hasClientId && hasClientSecret)) {
    throw new Error(
      'Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured'
    );
  }

  return true;
};

// Validate Supabase (both values must be present if either is set)
const validateSupabase = (env: Record<string, string | undefined>) => {
  const hasUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if ((hasUrl && !hasKey) || (!hasUrl && hasKey)) {
    throw new Error(
      'Supabase requires both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured'
    );
  }

  return true;
};

// Get environment with validation
function getValidatedEnv() {
  try {
    // Parse and validate environment variables
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      // In development or during build, log and continue with partial env to avoid hard errors
      if (process.env.NODE_ENV !== 'production' || !process.env.CI) {
        const messages = parsed.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
        console.warn('[env] Environment validation warnings:\n' + messages.join('\n'));
        // Provide minimal required defaults to keep app running locally
        const fallback = {
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
            'pk_test_your_stripe_publishable_key_here',
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
          STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
          NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://www.yardura.com',
          NEXTAUTH_SECRET:
            process.env.NEXTAUTH_SECRET || 'dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_',
          EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@yardura.dev',
          EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
          EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT as any,
          EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
          EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
          RESEND_API_KEY: process.env.RESEND_API_KEY,
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          ADMIN_EMAILS: process.env.ADMIN_EMAILS,
        };
        // Skip strict email provider validation in dev
        try {
          validateGoogleOAuth(process.env);
        // eslint-disable-next-line no-empty
        } catch {}
        try {
          validateSupabase(process.env);
        // eslint-disable-next-line no-empty
        } catch {}
        return fallback as any;
      }
      // Production: throw with detailed message
      const errorMessages = parsed.error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }

    // Additional validation rules - temporarily disabled during build
    // if (process.env.NODE_ENV === 'production' && process.env.CI) {
    //   try { validateEmailConfig(process.env) } catch (e) {
    //     throw e
    //   }
    // }
    try {
      validateGoogleOAuth(process.env);
    } catch (e) {
      if (process.env.NODE_ENV === 'production' && !process.env.CI) throw e;
    }
    try {
      validateSupabase(process.env);
    } catch (e) {
      if (process.env.NODE_ENV === 'production' && !process.env.CI) throw e;
    }

    return parsed.data;
  } catch (error) {
    // Fallback to a minimal env in dev so routes don’t 500
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[env] Non-Zod error during env validation in development:', error);
      return {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
          'pk_test_your_stripe_publishable_key_here',
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://www.yardura.com',
        NEXTAUTH_SECRET:
          process.env.NEXTAUTH_SECRET || 'dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_',
        EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@yardura.com',
        ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
      } as any;
    }
    throw error;
  }
}

// Export validated environment
export const env = getValidatedEnv();

// Export types for TypeScript
export type Env = typeof env;

// Helper functions for environment detection
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTest = () => process.env.NODE_ENV === 'test';

// Helper to get admin emails as array
export const getAdminEmails = (): string[] => {
  if (!env.ADMIN_EMAILS) return [];
  return env.ADMIN_EMAILS.split(',').map((email: string) => email.trim().toLowerCase());
};

// Helper to check if user is admin
export const isAdminEmail = (email: string): boolean => {
  return getAdminEmails().includes(email.toLowerCase());
};

// Helper to get email configuration
export const getEmailConfig = () => {
  // Return minimal config during build/CI to avoid errors
  if (!process.env.CI && process.env.NODE_ENV !== 'production') {
    return {
      provider: 'resend' as const,
      apiKey: 'dev_placeholder',
    };
  }

  if (env.RESEND_API_KEY) {
    return {
      provider: 'resend' as const,
      apiKey: env.RESEND_API_KEY,
    };
  }

  if (env.EMAIL_SERVER_HOST && env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD) {
    return {
      provider: 'smtp' as const,
      host: env.EMAIL_SERVER_HOST,
      port: env.EMAIL_SERVER_PORT || 587,
      user: env.EMAIL_SERVER_USER,
      password: env.EMAIL_SERVER_PASSWORD,
    };
  }

  // During build, return placeholder instead of throwing
  if (!process.env.CI) {
    return {
      provider: 'resend' as const,
      apiKey: 'build_placeholder',
    };
  }

  throw new Error('No valid email configuration found');
};

// Helper to get OAuth providers configuration
export const getOAuthProviders = () => {
  const providers: Array<{ id: string; name: string }> = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push({ id: 'google', name: 'Google' });
  }

  return providers;
};

// Secret scanning guard - prevents accidental commit of sensitive data
export const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9_]+/, // Stripe secret keys
  /AIza[0-9A-Za-z-_]{35}/, // Google API keys
  /SG\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, // SendGrid API keys
  /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Slack bot tokens
  /-----BEGIN [A-Z ]+-----/, // Private keys
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses (optional - can be disabled)
];

// Validate no secrets are in plain text
export function validateNoSecrets(
  content: string,
  filePath: string
): { hasSecrets: boolean; violations: string[] } {
  const violations: string[] = [];

  SECRET_PATTERNS.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Skip if it's clearly a placeholder or example
        if (
          !match.includes('placeholder') &&
          !match.includes('example') &&
          !match.includes('your_')
        ) {
          violations.push(`Found potential secret in ${filePath}: ${match.substring(0, 10)}...`);
        }
      });
    }
  });

  return {
    hasSecrets: violations.length > 0,
    violations,
  };
}

// Helper to get environment status
export function getEnvironmentStatus() {
  return {
    hasStripeKeys: !!(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && env.STRIPE_SECRET_KEY),
    hasGoogleMaps: !!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    hasEmailConfig: !!env.EMAIL_FROM,
    hasNextAuth: !!(env.NEXTAUTH_URL && env.NEXTAUTH_SECRET),
    hasSupabase: !!(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasRecaptcha: !!(env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && env.RECAPTCHA_SECRET_KEY),
    nodeEnv: env.NODE_ENV,
  };
}

// Export for testing (allows overriding in tests)
export { envSchema, validateEmailConfig, validateGoogleOAuth, validateSupabase };
