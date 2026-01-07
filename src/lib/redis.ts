import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

type GlobalRedisState = typeof globalThis & {
  __sharedRedisClient?: IORedis | null;
};

const globalRedis = globalThis as GlobalRedisState;

export function getRedisClient(): IORedis | null {
  if (!REDIS_URL) {
    return null;
  }

  if (!globalRedis.__sharedRedisClient) {
    globalRedis.__sharedRedisClient = new IORedis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
    });

    globalRedis.__sharedRedisClient.on("error", (error) => {
      console.warn("[redis] shared client error", error);
    });

    // Connect immediately to avoid "Stream isn't writeable" errors
    globalRedis.__sharedRedisClient.connect().catch((error) => {
      console.warn("[redis] failed to connect, cache will be disabled", error);
    });
  }

  // Ensure connection is established before returning
  if (!globalRedis.__sharedRedisClient.status || globalRedis.__sharedRedisClient.status === "end") {
    try {
      globalRedis.__sharedRedisClient.connect().catch(() => {
        // Connection will be retried on next use
      });
    } catch {
      // Already connecting or error
    }
  }

  return globalRedis.__sharedRedisClient;
}
