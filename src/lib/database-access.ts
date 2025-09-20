/**
 * Database Access Layer with Feature Flags
 *
 * This module provides a unified interface for database operations
 * that can toggle between SQLite (current) and Postgres (future)
 * based on feature flags and environment configuration.
 */

import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Feature flags for database migration
export const DB_FEATURE_FLAGS = {
  USE_POSTGRES: process.env.USE_POSTGRES === "true",
  READ_POSTGRES: process.env.READ_POSTGRES === "true",
  WRITE_POSTGRES: process.env.WRITE_POSTGRES === "true",
  MIGRATION_MODE: process.env.MIGRATION_MODE === "true",
} as const;

// Database clients
let sqliteClient: PrismaClient;
let postgresClient: PrismaClient | null = null;

// Initialize SQLite client (always available)
function getSqliteClient(): PrismaClient {
  if (!sqliteClient) {
    sqliteClient = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    });
  }
  return sqliteClient;
}

// Initialize Postgres client (only when configured)
function getPostgresClient(): PrismaClient | null {
  if (!env.POSTGRES_DATABASE_URL) {
    return null;
  }

  if (!postgresClient) {
    postgresClient = new PrismaClient({
      datasourceUrl: env.POSTGRES_DATABASE_URL,
      log:
        process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
    });
  }
  return postgresClient;
}

// Main database access function
export function getDb(): PrismaClient {
  // If Postgres is enabled and available, use it
  if (DB_FEATURE_FLAGS.USE_POSTGRES) {
    const pgClient = getPostgresClient();
    if (pgClient) {
      return pgClient;
    }
  }

  // Fallback to SQLite (always available)
  return getSqliteClient();
}

// Model-specific database selection
export function getDbForModel(modelName: string): PrismaClient {
  // Critical models that must remain on SQLite during migration
  const criticalModels = [
    "User",
    "Account",
    "Session",
    "VerificationToken",
    "ServiceVisit",
    "Commission",
  ];

  // If model is critical and we're not in full migration mode
  if (criticalModels.includes(modelName) && !DB_FEATURE_FLAGS.MIGRATION_MODE) {
    return getSqliteClient();
  }

  // For read operations, prefer Postgres if available and enabled
  if (DB_FEATURE_FLAGS.READ_POSTGRES && !DB_FEATURE_FLAGS.WRITE_POSTGRES) {
    const pgClient = getPostgresClient();
    if (pgClient) {
      return pgClient;
    }
  }

  // For write operations, only use Postgres if explicitly enabled
  if (DB_FEATURE_FLAGS.WRITE_POSTGRES) {
    const pgClient = getPostgresClient();
    if (pgClient) {
      return pgClient;
    }
  }

  // Default to main database selection
  return getDb();
}

// Utility functions for migration
export const dbUtils = {
  // Check if both databases are available
  hasDualSetup: () => {
    return !!(env.POSTGRES_DATABASE_URL && getPostgresClient());
  },

  // Get database statistics
  async getStats(db: PrismaClient) {
    try {
      const [
        userCount,
        dogCount,
        serviceVisitCount,
        dataReadingCount,
        orgCount,
      ] = await Promise.all([
        db.user.count(),
        db.dog.count(),
        db.serviceVisit.count(),
        db.dataReading.count(),
        db.org.count(),
      ]);

      return {
        users: userCount,
        dogs: dogCount,
        serviceVisits: serviceVisitCount,
        dataReadings: dataReadingCount,
        orgs: orgCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to get database stats:", error);
      return null;
    }
  },

  // Validate data consistency between databases
  async validateConsistency() {
    if (!dbUtils.hasDualSetup()) {
      return { valid: false, reason: "Dual database setup not available" };
    }

    const sqlite = getSqliteClient();
    const postgres = getPostgresClient()!;

    const sqliteStats = await dbUtils.getStats(sqlite);
    const postgresStats = await dbUtils.getStats(postgres);

    if (!sqliteStats || !postgresStats) {
      return { valid: false, reason: "Failed to retrieve statistics" };
    }

    // Check if critical counts match
    const criticalCountsMatch =
      sqliteStats.users === postgresStats.users &&
      sqliteStats.serviceVisits === postgresStats.serviceVisits;

    return {
      valid: criticalCountsMatch,
      sqliteStats,
      postgresStats,
      differences: {
        users: postgresStats.users - sqliteStats.users,
        dogs: postgresStats.dogs - sqliteStats.dogs,
        serviceVisits: postgresStats.serviceVisits - sqliteStats.serviceVisits,
        dataReadings: postgresStats.dataReadings - sqliteStats.dataReadings,
        orgs: postgresStats.orgs - sqliteStats.orgs,
      },
    };
  },
};

// Export both clients for direct access when needed
export const sqliteDb = getSqliteClient();
export const postgresDb = () => getPostgresClient();
