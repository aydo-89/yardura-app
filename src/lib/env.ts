import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
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

  // Optional: Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Admin configuration
  ADMIN_EMAILS: z.string().optional(),
});

// Validate email configuration (either SMTP or Resend must be configured)
const validateEmailConfig = (env: Record<string, string | undefined>) => {
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
    const parsed = envSchema.parse(process.env);

    // Additional validation rules
    validateEmailConfig(process.env);
    validateGoogleOAuth(process.env);
    validateSupabase(process.env);

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
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
  return env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
};

// Helper to check if user is admin
export const isAdminEmail = (email: string): boolean => {
  return getAdminEmails().includes(email.toLowerCase());
};

// Helper to get email configuration
export const getEmailConfig = () => {
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

// Export for testing (allows overriding in tests)
export { envSchema, validateEmailConfig, validateGoogleOAuth, validateSupabase };
