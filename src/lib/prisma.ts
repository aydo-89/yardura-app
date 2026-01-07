import { PrismaClient } from "@prisma/client";

import { databaseConfig } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a single Prisma client for PostgreSQL with connection pooling
const databaseUrl = databaseConfig.poolerUrl;

if (!databaseUrl) {
  throw new Error(
    "No database connection string found. Set DATABASE_URL or DATABASE_POOLER_URL.",
  );
}

if (process.env.DATABASE_URL !== databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // In dev: show queries but not the noisy "connection closed" errors
    // These errors are harmless - PgBouncer closes idle connections and Prisma retries automatically
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "query" },
            { emit: "stdout", level: "warn" },
            // Suppress "Error in PostgreSQL connection: Closed" noise from PgBouncer
            // { emit: "stdout", level: "error" },
          ]
        : ["error"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

// Cache the client in development to prevent too many connections during hot reload
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
