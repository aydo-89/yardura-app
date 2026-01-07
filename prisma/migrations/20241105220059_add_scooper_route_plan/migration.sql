-- CreateTable
CREATE TABLE "ScooperRoutePlan" (
    "id" TEXT NOT NULL,
    "scooperId" TEXT NOT NULL,
    "dateKey" TIMESTAMP(3),
    "signature" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" JSONB,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScooperRoutePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScooperRoutePlan_signature_key" ON "ScooperRoutePlan"("signature");

-- CreateIndex
CREATE INDEX "ScooperRoutePlan_scooperId_dateKey_idx" ON "ScooperRoutePlan"("scooperId", "dateKey");

-- AddForeignKey
ALTER TABLE "ScooperRoutePlan" ADD CONSTRAINT "ScooperRoutePlan_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
