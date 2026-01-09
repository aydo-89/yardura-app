import { PrismaClient } from "@prisma/client";

import { databaseConfig } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDirect: PrismaClient | undefined;
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

/**
 * Standard Prisma client using the connection pooler (PgBouncer).
 * Best for most API routes with short-lived queries.
 * 
 * Note: Has a ~60s statement timeout. For long-running queries,
 * use `prismaDirect` instead.
 */
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

/**
 * Direct Prisma client bypassing the connection pooler.
 * Use for:
 * - Long-running queries (migrations, bulk operations)
 * - Scripts and workers
 * - Queries that need longer statement timeouts
 * 
 * The direct connection is ~10x faster for PostGIS queries
 * because it maintains the search path correctly.
 */
export const prismaDirect =
  globalForPrisma.prismaDirect ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["error"],
    datasources: {
      db: {
        url: databaseConfig.directUrl,
      },
    },
  });

// Cache the clients in development to prevent too many connections during hot reload
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDirect = prismaDirect;
}
