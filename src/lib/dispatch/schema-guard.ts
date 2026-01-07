import { prisma } from "@/lib/prisma";

let ensured = false;
let skippedLogged = false;

async function ensureRouteStopStatusEnum() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END
    $$;
  `);
}

async function ensureRouteTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Route" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      "date" TIMESTAMPTZ NOT NULL,
      "scheduledDate" TIMESTAMPTZ,
      "techId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'planned',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RouteInstance" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      "date" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "scheduledDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "status" TEXT NOT NULL DEFAULT 'planned',
      "templateId" TEXT,
      "technicianId" TEXT,
      "dispatcherId" TEXT,
      "optimizationState" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RouteStop" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT,
      "serviceVisitId" TEXT NOT NULL UNIQUE,
      "routeId" TEXT,
      "routeInstanceId" TEXT,
      "technicianId" TEXT,
      "stopOrder" INTEGER,
      "position" INTEGER,
      "estimatedArrival" TIMESTAMPTZ,
      "scheduledArrival" TIMESTAMPTZ,
      "scheduledDeparture" TIMESTAMPTZ,
      "actualArrival" TIMESTAMPTZ,
      "actualDeparture" TIMESTAMPTZ,
      "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RouteStop"
      ADD COLUMN IF NOT EXISTS "routeId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RouteStop"
      ADD COLUMN IF NOT EXISTS "routeInstanceId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RouteStop"
      ADD COLUMN IF NOT EXISTS "technicianId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DispatchEvent" (
      "id" TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      "serviceVisitId" TEXT,
      "routeStopId" TEXT,
      "eventType" TEXT NOT NULL,
      "performedBy" TEXT,
      "actorId" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE "Route"
          ADD CONSTRAINT "Route_techId_fkey"
          FOREIGN KEY ("techId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteInstance"
          ADD CONSTRAINT "RouteInstance_technicianId_fkey"
          FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteInstance"
          ADD CONSTRAINT "RouteInstance_dispatcherId_fkey"
          FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_serviceVisitId_fkey"
          FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_routeId_fkey"
          FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_routeInstanceId_fkey"
          FOREIGN KEY ("routeInstanceId") REFERENCES "RouteInstance"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_technicianId_fkey"
          FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Route_orgId_date_idx" ON "Route" ("orgId", "date");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Route_techId_idx" ON "Route" ("techId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteInstance_orgId_date_idx" ON "RouteInstance" ("orgId", "date");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteInstance_scheduledDate_idx" ON "RouteInstance" ("scheduledDate");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteInstance_technicianId_idx" ON "RouteInstance" ("technicianId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteInstance_dispatcherId_idx" ON "RouteInstance" ("dispatcherId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteStop_orgId_idx" ON "RouteStop" ("orgId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteStop_routeId_idx" ON "RouteStop" ("routeId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteStop_routeInstanceId_idx" ON "RouteStop" ("routeInstanceId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteStop_technicianId_idx" ON "RouteStop" ("technicianId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "RouteStop_status_idx" ON "RouteStop" ("status");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DispatchEvent_orgId_idx" ON "DispatchEvent" ("orgId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DispatchEvent_serviceVisitId_idx" ON "DispatchEvent" ("serviceVisitId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DispatchEvent_routeStopId_idx" ON "DispatchEvent" ("routeStopId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DispatchEvent_actorId_idx" ON "DispatchEvent" ("actorId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DispatchEvent_createdAt_idx" ON "DispatchEvent" ("createdAt");
  `);
}

/**
 * Ensures legacy production databases have the columns required for the new dispatch features.
 * Uses idempotent ALTER statements so it is safe to call on every server cold start.
 */
export async function ensureDispatchSchema() {
  // In development, Fast Refresh / frequent server restarts can cause this guard to run many times,
  // which is expensive (DDL + indexes) and can destabilize request latency/connection pools.
  // If you *really* want to run it locally, set ENABLE_DISPATCH_SCHEMA_GUARD=true.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DISPATCH_SCHEMA_GUARD !== "true"
  ) {
    if (!skippedLogged) {
      skippedLogged = true;
      console.warn(
        "[dispatch.schema] Skipping ensureDispatchSchema() (non-production). Set ENABLE_DISPATCH_SCHEMA_GUARD=true to enable.",
      );
    }
    ensured = true;
    return;
  }

  if (ensured) {
    return;
  }

  await ensureRouteStopStatusEnum();
  await ensureRouteTables();

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      -- RouteInstance technician / dispatcher relations
      ALTER TABLE "RouteInstance"
        ADD COLUMN IF NOT EXISTS "technicianId" TEXT;

      ALTER TABLE "RouteInstance"
        ADD COLUMN IF NOT EXISTS "dispatcherId" TEXT;

      ALTER TABLE "RouteInstance"
        ADD COLUMN IF NOT EXISTS "date" TIMESTAMP;

      -- Foreign keys are created conditionally to avoid duplicates
      BEGIN
        ALTER TABLE "RouteInstance"
          ADD CONSTRAINT "RouteInstance_technicianId_fkey"
          FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteInstance"
          ADD CONSTRAINT "RouteInstance_dispatcherId_fkey"
          FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      -- RouteStop linkage to RouteInstance / Route / Technician
      ALTER TABLE "RouteStop"
        ADD COLUMN IF NOT EXISTS "routeInstanceId" TEXT;

      ALTER TABLE "RouteStop"
        ADD COLUMN IF NOT EXISTS "routeId" TEXT;

      ALTER TABLE "RouteStop"
        ADD COLUMN IF NOT EXISTS "technicianId" TEXT;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_routeInstanceId_fkey"
          FOREIGN KEY ("routeInstanceId") REFERENCES "RouteInstance"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_routeId_fkey"
          FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      BEGIN
        ALTER TABLE "RouteStop"
          ADD CONSTRAINT "RouteStop_technicianId_fkey"
          FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;

      -- Helpful indexes (idempotent)
      CREATE INDEX IF NOT EXISTS "RouteInstance_scheduledDate_idx" ON "RouteInstance" ("scheduledDate");
      CREATE INDEX IF NOT EXISTS "RouteInstance_technicianId_idx" ON "RouteInstance" ("technicianId");
      CREATE INDEX IF NOT EXISTS "RouteInstance_dispatcherId_idx" ON "RouteInstance" ("dispatcherId");
      CREATE INDEX IF NOT EXISTS "RouteStop_routeInstanceId_idx" ON "RouteStop" ("routeInstanceId");
      CREATE INDEX IF NOT EXISTS "RouteStop_routeId_idx" ON "RouteStop" ("routeId");
      CREATE INDEX IF NOT EXISTS "RouteStop_technicianId_idx" ON "RouteStop" ("technicianId");
    END
    $$;
  `);

  ensured = true;
}
