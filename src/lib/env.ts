/**
 * Environment variable validation using Zod
 */

import { z } from "zod";

// Environment schema
const envSchema = z.object({
  // Database (optional for client-side)
  DATABASE_URL: z.string().url().optional(),
  DATABASE_POOLER_URL: z.string().url().optional(),
  POSTGRES_DATABASE_URL: z.string().url().optional(),

  // NextAuth (optional for client-side)
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_COOKIE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Unwrangle (Chewy product data API)
  UNWRANGLE_API_KEY: z.string().optional(),

  // Stripe (optional for client-side)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // RevenueCat (optional for client-side)
  REVENUECAT_WEBHOOK_SECRET: z.string().min(1).optional(),
  REVENUECAT_PREMIUM_ENTITLEMENT_ID: z.string().min(1).optional(),
  // RevenueCat Secret API Key (server-side only; never expose to clients)
  REVENUECAT_SECRET_API_KEY: z.string().min(1).optional(),

  // Google Maps (optional for now)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().optional(),
  GOOGLE_MAPS_BROWSER_API_KEY: z.string().optional(),

  // Google Auth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email Configuration
  EMAIL_FROM: z.string().default("noreply@yardura.com"),
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
  NOMINATIM_BASE: z
    .string()
    .url()
    .default("https://nominatim.openstreetmap.org"),
  NOMINATIM_EMAIL: z.string().email().default("contact@yardura.com"),

  // ZIP processing
  ZIP_AREA_THRESHOLD: z
    .string()
    .regex(/^(0\.\d+|1\.0)$/)
    .default("0.25"),
  ZIPCODESTACK_API_KEY: z.string().optional(),
  ZIPCODESTACK_BASE_URL: z.string().url().optional(),

  // Debug flags
  NEXT_PUBLIC_DEBUG: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Redis (optional; jobs use defaults locally)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Supabase (if used)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Twilio (optional; SMS fall back to console when missing)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_YARDURA_SID: z.string().optional(),
  TWILIO_YARDURA_SECRET: z.string().optional(),
  TWILIO_VOICE_WEBHOOK_AUTH: z.string().optional(),
  TWILIO_VOICE_STATUS_AUTH: z.string().optional(),

  // Voice agent providers
  GROQ_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  CARTESIA_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  VAPI_API_KEY: z.string().optional(),
  VAPI_PHONE_NUMBER_ID: z.string().optional(),
  VOICE_AGENT_JWT_SECRET: z.string().optional(),
  VOICE_AGENT_STREAM_BASE_URL: z.string().optional(),
  VOICE_AGENT_KNOWLEDGE_PATH: z.string().optional(),
  VOICE_AGENT_DEFAULT_LOCALE: z.string().optional(),
  VOICE_AGENT_PRIMARY_MODEL: z.string().optional(),
  VOICE_AGENT_FALLBACK_MODEL: z.string().optional(),
  VOICE_AGENT_WEBHOOK_BASE_URL: z.string().url().optional(),
});

// Parse and validate environment variables
let validatedEnv: z.infer<typeof envSchema>;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Environment validation failed:");
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`- ${err.path.join(".")}: ${err.message}`);
    });
  }

  // For missing required fields, try partial parsing with defaults
  try {
    const partialEnv = envSchema.partial().parse(process.env);
    const fallbackDatabaseUrl =
      partialEnv.DATABASE_URL ||
      partialEnv.DATABASE_POOLER_URL ||
      partialEnv.POSTGRES_DATABASE_URL ||
      "postgresql://localhost:5432/yardura";

    validatedEnv = envSchema.parse({
      ...partialEnv,
      // Provide defaults for required fields
      DATABASE_URL: fallbackDatabaseUrl,
      NEXTAUTH_SECRET: partialEnv.NEXTAUTH_SECRET || "development-secret-key",
      STRIPE_SECRET_KEY: partialEnv.STRIPE_SECRET_KEY || "sk_test_default",
      STRIPE_PUBLISHABLE_KEY:
        partialEnv.STRIPE_PUBLISHABLE_KEY || "pk_test_default",
      STRIPE_WEBHOOK_SECRET:
        partialEnv.STRIPE_WEBHOOK_SECRET || "whsec_default",
      EMAIL_FROM: partialEnv.EMAIL_FROM || "noreply@yardura.com",
    });
  } catch (fallbackError) {
    console.error("Failed to parse environment with fallbacks:", fallbackError);
    throw new Error("Environment validation failed completely");
  }

  // Log warnings for missing required values in development
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Some environment variables are missing or invalid, using defaults where possible",
    );
  }
}

// Export validated environment
export { validatedEnv as env };

const DEFAULT_DATABASE_URL = "postgresql://localhost:5432/yardura";
const DEFAULT_SITE_URL =
  validatedEnv.NODE_ENV === "production"
    ? "https://www.getinsightscoop.com"
    : "http://localhost:3000";

const supabaseProjectRef =
  extractSupabaseProjectRef(validatedEnv.NEXT_PUBLIC_SUPABASE_URL) ??
  extractSupabaseProjectRef(validatedEnv.DATABASE_URL) ??
  extractSupabaseProjectRef(validatedEnv.POSTGRES_DATABASE_URL);

export const databaseConfig = {
  get poolerUrl(): string {
    const candidate =
      validatedEnv.DATABASE_POOLER_URL ||
      validatedEnv.DATABASE_URL ||
      validatedEnv.POSTGRES_DATABASE_URL ||
      DEFAULT_DATABASE_URL;

    return normalizeSupabasePoolerUrl(candidate, supabaseProjectRef);
  },
  get directUrl(): string {
    return (
      validatedEnv.POSTGRES_DATABASE_URL ||
      validatedEnv.DATABASE_URL ||
      validatedEnv.DATABASE_POOLER_URL ||
      DEFAULT_DATABASE_URL
    );
  },
};

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
    return validatedEnv.NEXT_PUBLIC_DEBUG === "true";
  },

  // Google Maps
  get googleMapsServerApiKey(): string | undefined {
    return (
      validatedEnv.GOOGLE_MAPS_SERVER_API_KEY ||
      validatedEnv.GOOGLE_MAPS_API_KEY ||
      validatedEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    );
  },

  get googleMapsBrowserApiKey(): string | undefined {
    return (
      validatedEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      validatedEnv.GOOGLE_MAPS_BROWSER_API_KEY ||
      validatedEnv.GOOGLE_MAPS_API_KEY
    );
  },

  get googleMapsApiKey(): string | undefined {
    return (
      validatedEnv.GOOGLE_MAPS_SERVER_API_KEY ||
      validatedEnv.GOOGLE_MAPS_API_KEY ||
      validatedEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      validatedEnv.GOOGLE_MAPS_BROWSER_API_KEY
    );
  },

  // ZIP API
  get zipCodeStackApiKey(): string | undefined {
    return validatedEnv.ZIPCODESTACK_API_KEY;
  },

  get zipCodeStackBaseUrl(): string {
    return (
      validatedEnv.ZIPCODESTACK_BASE_URL || "https://api.zipcodestack.com/v1"
    );
  },
};

export function getSiteUrl(): string {
  const candidates = [
    validatedEnv.NEXTAUTH_URL,
    validatedEnv.NEXT_PUBLIC_APP_URL,
    validatedEnv.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      const url = new URL(candidate);
      const hostname = url.hostname.toLowerCase();

      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".local")
      ) {
        continue;
      }

      if (url.protocol !== "https:") {
        url.protocol = "https:";
      }

      return url.toString();
    } catch {
      continue;
    }
  }

  return DEFAULT_SITE_URL;
}

// Email configuration helper
export function getEmailConfig() {
  const smtpHost = validatedEnv.SMTP_HOST;
  const smtpUser = validatedEnv.SMTP_USER;
  const smtpPass = validatedEnv.SMTP_PASS;
  const resendApiKey = validatedEnv.RESEND_API_KEY;

  // Determine email provider based on available configuration
  let provider: "smtp" | "resend" | "console" = "console";
  let smtpConfig = null;

  // Prefer Resend when an API key is provided; otherwise fall back to SMTP when fully configured
  if (resendApiKey) {
    provider = "resend";
  } else if (smtpHost && smtpUser && smtpPass) {
    provider = "smtp";
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
  return email.endsWith("@yardura.com") || email.endsWith("@admin.yardura.com");
}

function extractSupabaseProjectRef(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;

    const directMatch = host.match(/^([a-z0-9]{15,})\.supabase\.[a-z.]+$/);
    if (directMatch) {
      return directMatch[1];
    }

    const dbMatch = host.match(/^db\.([a-z0-9]{15,})\.supabase\.[a-z.]+$/);
    if (dbMatch) {
      return dbMatch[1];
    }
  } catch {
    // ignore parse errors
  }

  return undefined;
}

function normalizeSupabasePoolerUrl(
  url: string,
  projectRef: string | undefined,
): string {
  if (!projectRef) return url;

  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes("pooler.supabase.com")) {
      return url;
    }

    const username = parsed.username;

    if (!username || username.includes(".")) {
      // Still ensure pooler-friendly params even if username is already scoped
      const params = parsed.searchParams;
      if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
      // Supabase pooler + Prisma can stall if too many concurrent connections are opened.
      // Keep this small for tiny droplets.
      if (!params.has("connection_limit")) params.set("connection_limit", "5");
      if (!params.has("pool_timeout")) params.set("pool_timeout", "10");
      if (!params.has("connect_timeout")) params.set("connect_timeout", "5");
      parsed.search = params.toString();
      return parsed.toString();
    }

    parsed.username = `${username}.${projectRef}`;

    const params = parsed.searchParams;
    if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
    if (!params.has("connection_limit")) params.set("connection_limit", "5");
    if (!params.has("pool_timeout")) params.set("pool_timeout", "10");
    if (!params.has("connect_timeout")) params.set("connect_timeout", "5");
    parsed.search = params.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}
