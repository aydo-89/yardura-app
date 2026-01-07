-- Add walk tracking for premium wellness
CREATE TABLE "CustomerWellnessWalk" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "dogId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "distanceMeters" DOUBLE PRECISION NOT NULL,
  "path" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerWellnessWalk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerWellnessWalk_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerWellnessWalk_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerWellnessWalk_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CustomerWellnessWalk_customerId_startedAt_idx" ON "CustomerWellnessWalk"("customerId", "startedAt");
CREATE INDEX "CustomerWellnessWalk_orgId_startedAt_idx" ON "CustomerWellnessWalk"("orgId", "startedAt");
CREATE INDEX "CustomerWellnessWalk_dogId_idx" ON "CustomerWellnessWalk"("dogId");
