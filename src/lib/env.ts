
/**
 * Environment variable validation using Zod
 */

import { z } from 'zod';

// Environment schema
const envSchema = z.object({
  // Database (optional for client-side)
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_DATABASE_URL: z.string().url().optional(),

  // NextAuth (optional for client-side)
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Stripe (optional for client-side)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Google Maps (optional for now)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Google Auth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email Configuration
  EMAIL_FROM: z.string().default('noreply@yardura.com'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Alternative: Resend API (if SMTP not configured)
  RESEND_API_KEY: z.string().optional(),

  // reCAPTCHA
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: z.string().optional(),

  // Storage
  STORAGE_BUCKET: z.string().optional(),

  // Nominatim configuration
  NOMINATIM_BASE: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_EMAIL: z.string().email().default('contact@yardura.com'),

  // ZIP processing
  ZIP_AREA_THRESHOLD: z.string().regex(/^(0\.\d+|1\.0)$/).default('0.25'),
  ZIPCODESTACK_API_KEY: z.string().optional(),
  ZIPCODESTACK_BASE_URL: z.string().url().optional(),

  // Debug flags
  NEXT_PUBLIC_DEBUG: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Redis (optional; jobs use defaults locally)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Supabase (if used)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

// Parse and validate environment variables
let validatedEnv: z.infer<typeof envSchema>;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment validation failed:');
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
  }

  // For missing required fields, try partial parsing with defaults
  try {
    const partialEnv = envSchema.partial().parse(process.env);
    validatedEnv = envSchema.parse({
      ...partialEnv,
      // Provide defaults for required fields
      DATABASE_URL: partialEnv.DATABASE_URL || 'postgresql://localhost:5432/yardura',
      NEXTAUTH_SECRET: partialEnv.NEXTAUTH_SECRET || 'development-secret-key',
      STRIPE_SECRET_KEY: partialEnv.STRIPE_SECRET_KEY || 'sk_test_default',
      STRIPE_PUBLISHABLE_KEY: partialEnv.STRIPE_PUBLISHABLE_KEY || 'pk_test_default',
      STRIPE_WEBHOOK_SECRET: partialEnv.STRIPE_WEBHOOK_SECRET || 'whsec_default',
      EMAIL_FROM: partialEnv.EMAIL_FROM || 'noreply@yardura.com',
    });
  } catch (fallbackError) {
    console.error('Failed to parse environment with fallbacks:', fallbackError);
    throw new Error('Environment validation failed completely');
  }

  // Log warnings for missing required values in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('Some environment variables are missing or invalid, using defaults where possible');
  }
}

// Export validated environment
export { validatedEnv as env };

// Helper functions for commonly used values
export const config = {
  // ZIP processing
  get zipAreaThreshold(): number {
    return parseFloat(validatedEnv.ZIP_AREA_THRESHOLD);
  },

  // Nominatim
  get nominatimBase(): string {
    return validatedEnv.NOMINATIM_BASE;
  },

  get nominatimEmail(): string {
    return validatedEnv.NOMINATIM_EMAIL;
  },

  // Debug
  get isDebug(): boolean {
    return validatedEnv.NEXT_PUBLIC_DEBUG === 'true';
  },

  // Google Maps
  get googleMapsApiKey(): string | undefined {
    return validatedEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  },

  // ZIP API
  get zipCodeStackApiKey(): string | undefined {
    return validatedEnv.ZIPCODESTACK_API_KEY;
  },

  get zipCodeStackBaseUrl(): string {
    return validatedEnv.ZIPCODESTACK_BASE_URL || 'https://api.zipcodestack.com/v1';
  }
};

// Email configuration helper
export function getEmailConfig() {
  const smtpHost = validatedEnv.SMTP_HOST;
  const smtpUser = validatedEnv.SMTP_USER;
  const smtpPass = validatedEnv.SMTP_PASS;
  const resendApiKey = validatedEnv.RESEND_API_KEY;

  // Determine email provider based on available configuration
  let provider: 'smtp' | 'resend' | 'console' = 'console';
  let smtpConfig = null;

  // Prefer Resend when an API key is provided; otherwise fall back to SMTP when fully configured
  if (resendApiKey) {
    provider = 'resend';
  } else if (smtpHost && smtpUser && smtpPass) {
    provider = 'smtp';
    smtpConfig = {
      host: smtpHost,
      port: validatedEnv.SMTP_PORT,
      secure: validatedEnv.SMTP_SECURE,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };
  }

  return {
    provider,
    from: validatedEnv.EMAIL_FROM,
    smtp: smtpConfig,
    resendApiKey,
  };
}

export function isAdminEmail(email: string): boolean {
  // Simple check - could be enhanced
  return email.endsWith('@yardura.com') || email.endsWith('@admin.yardura.com');
}
