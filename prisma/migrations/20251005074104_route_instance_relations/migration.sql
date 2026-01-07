-- Ensure RouteInstance includes dispatcher/technician relationships
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'RouteInstance' AND column_name = 'technicianId'
  ) THEN
    ALTER TABLE "RouteInstance" ADD COLUMN "technicianId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'RouteInstance' AND column_name = 'dispatcherId'
  ) THEN
    ALTER TABLE "RouteInstance" ADD COLUMN "dispatcherId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'RouteInstance_technicianId_fkey'
  ) THEN
    ALTER TABLE "RouteInstance" 
      ADD CONSTRAINT "RouteInstance_technicianId_fkey"
      FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'RouteInstance_dispatcherId_fkey'
  ) THEN
    ALTER TABLE "RouteInstance" 
      ADD CONSTRAINT "RouteInstance_dispatcherId_fkey"
      FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- RouteStop linkage to RouteInstance and Route
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'RouteStop' AND column_name = 'routeInstanceId'
  ) THEN
    ALTER TABLE "RouteStop" ADD COLUMN "routeInstanceId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'RouteStop' AND column_name = 'routeId'
  ) THEN
    ALTER TABLE "RouteStop" ADD COLUMN "routeId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'RouteStop' AND column_name = 'technicianId'
  ) THEN
    ALTER TABLE "RouteStop" ADD COLUMN "technicianId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'RouteStop_routeInstanceId_fkey'
  ) THEN
    ALTER TABLE "RouteStop" 
      ADD CONSTRAINT "RouteStop_routeInstanceId_fkey"
      FOREIGN KEY ("routeInstanceId") REFERENCES "RouteInstance"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'RouteStop_routeId_fkey'
  ) THEN
    ALTER TABLE "RouteStop" 
      ADD CONSTRAINT "RouteStop_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'RouteStop_technicianId_fkey'
  ) THEN
    ALTER TABLE "RouteStop" 
      ADD CONSTRAINT "RouteStop_technicianId_fkey"
      FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RouteStop_routeInstanceId_idx" ON "RouteStop" ("routeInstanceId");
CREATE INDEX IF NOT EXISTS "RouteStop_routeId_idx" ON "RouteStop" ("routeId");
CREATE INDEX IF NOT EXISTS "RouteStop_technicianId_idx" ON "RouteStop" ("technicianId");
