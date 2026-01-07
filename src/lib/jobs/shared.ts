import { env } from "@/lib/env";
import type { RedisOptions } from "ioredis";

type ParsedRedisUrl = {
  host: string;
  port: number;
  password?: string;
  useTls: boolean;
};

// Parse REDIS_URL if available, otherwise fall back to individual env vars.
function parseRedisUrl(): ParsedRedisUrl | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      useTls: url.protocol === "rediss:",
    };
  } catch {
    return null;
  }
}

// BullMQ accepts ioredis connection options. This helper supports:
// - Upstash via REDIS_URL (typically rediss://..., requires TLS)
// - Local/self-hosted Redis via REDIS_HOST/REDIS_PORT/REDIS_PASSWORD
export function getRedisConnectionConfig(): RedisOptions {
  const fromUrl = parseRedisUrl();
  if (fromUrl) {
    return {
      host: fromUrl.host,
      port: fromUrl.port,
      password: fromUrl.password,
      // Upstash recommendations for BullMQ / ioredis:
      // - disable ready check (Upstash can block some commands)
      // - maxRetriesPerRequest must be null for BullMQ
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      tls: fromUrl.useTls ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: env.REDIS_HOST || "127.0.0.1",
    port: Number(env.REDIS_PORT || 6379),
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

export function shouldAutoStartWorkers(): boolean {
  return process.env.JOB_WORKER === "true";
}

export function queueUnavailableReason(): string | null {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "Next.js build phase";
  }

  return null;
}

