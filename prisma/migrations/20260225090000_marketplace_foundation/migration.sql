-- Marketplace foundation: enums, tables, and relationships for scooper marketplace

-- Create new enums
CREATE TYPE "ServiceTileStatus" AS ENUM ('DRAFT', 'WAITLIST', 'LIVE', 'SUSPENDED');
CREATE TYPE "ScooperStatus" AS ENUM ('APPLICANT', 'PENDING_REVIEW', 'CERTIFIED', 'PAUSED', 'DEACTIVATED');
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'PASSED', 'FAILED');
CREATE TYPE "CertificationType" AS ENUM ('BIN_DROP', 'HAUL_AWAY', 'ECO_DIVERT_25', 'ECO_DIVERT_50', 'ECO_DIVERT_100');
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "AvailabilityWindow" AS ENUM ('AM', 'PM', 'FULL', 'CUSTOM');
CREATE TYPE "ScooperDeviceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "VisitOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REJECTED', 'RECALLED');
CREATE TYPE "RouteShiftStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING_REVIEW', 'READY', 'RELEASED', 'DISPUTED', 'VOID');
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYOUT', 'BONUS', 'PENALTY', 'REIMBURSEMENT', 'ADJUSTMENT');
CREATE TYPE "QaOutcome" AS ENUM ('PASS', 'WARN', 'FAIL');

-- Extend ServiceVisit with marketplace routing fields
ALTER TABLE "ServiceVisit"
  ADD COLUMN "backupAssignedToId" TEXT,
  ADD COLUMN "tileId" TEXT,
  ADD COLUMN "routeShiftId" TEXT,
  ADD COLUMN "requiredCertifications" JSONB,
  ADD COLUMN "revenueCents" INTEGER;

ALTER TABLE "Job"
  ADD COLUMN "tileId" TEXT,
  ADD COLUMN "perVisitRevenueCents" INTEGER;

CREATE INDEX "Job_tileId_idx" ON "Job" ("tileId");

CREATE INDEX "ServiceVisit_backupAssignedToId_idx" ON "ServiceVisit" ("backupAssignedToId");
CREATE INDEX "ServiceVisit_tileId_idx" ON "ServiceVisit" ("tileId");
CREATE INDEX "ServiceVisit_routeShiftId_idx" ON "ServiceVisit" ("routeShiftId");

ALTER TABLE "ServiceVisit"
  ADD CONSTRAINT "ServiceVisit_backupAssignedToId_fkey" FOREIGN KEY ("backupAssignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Service tiles and readiness snapshots
CREATE TABLE "ServiceTile" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "territoryId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ServiceTileStatus" NOT NULL DEFAULT 'DRAFT',
  "goLiveDate" TIMESTAMP(3),
  "minCertifiedScoopers" INTEGER NOT NULL DEFAULT 0,
  "minCustomerUnits" INTEGER NOT NULL DEFAULT 0,
  "serviceWindows" JSONB,
  "coverageRadiusMeters" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceTile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceTile_orgId_idx" ON "ServiceTile" ("orgId");
CREATE INDEX "ServiceTile_territoryId_idx" ON "ServiceTile" ("territoryId");
CREATE UNIQUE INDEX "ServiceTile_orgId_slug_key" ON "ServiceTile" ("orgId", "slug");

CREATE TABLE "TileMetricSnapshot" (
  "id" TEXT NOT NULL,
  "tileId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "weekOf" TIMESTAMP(3) NOT NULL,
  "activeScoopers" INTEGER NOT NULL DEFAULT 0,
  "scheduledStops" INTEGER NOT NULL DEFAULT 0,
  "completedStops" INTEGER NOT NULL DEFAULT 0,
  "avgMilesPerStop" DOUBLE PRECISION,
  "avgRating" DOUBLE PRECISION,
  "fillRate" DOUBLE PRECISION,
  "churnRate" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TileMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TileMetricSnapshot_orgId_weekOf_idx" ON "TileMetricSnapshot" ("orgId", "weekOf");
CREATE INDEX "TileMetricSnapshot_tileId_idx" ON "TileMetricSnapshot" ("tileId");
CREATE UNIQUE INDEX "TileMetricSnapshot_tileId_weekOf_key" ON "TileMetricSnapshot" ("tileId", "weekOf");

-- Scooper lifecycle tables
CREATE TABLE "ScooperProfile" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ScooperStatus" NOT NULL DEFAULT 'APPLICANT',
  "backgroundCheckStatus" "BackgroundCheckStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "backgroundCheckSubmittedAt" TIMESTAMP(3),
  "backgroundCheckCompletedAt" TIMESTAMP(3),
  "vehicleVerified" BOOLEAN NOT NULL DEFAULT false,
  "vehicleDetail" TEXT,
  "insuranceProofUrl" TEXT,
  "trainingCompletedAt" TIMESTAMP(3),
  "ndaAcceptedAt" TIMESTAMP(3),
  "gearKitAcknowledgedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScooperProfile_userId_key" ON "ScooperProfile" ("userId");
CREATE INDEX "ScooperProfile_orgId_idx" ON "ScooperProfile" ("orgId");

CREATE TABLE "ScooperCertification" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "type" "CertificationType" NOT NULL,
  "status" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "issuedById" TEXT,
  "evidenceUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperCertification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperCertification_orgId_idx" ON "ScooperCertification" ("orgId");
CREATE INDEX "ScooperCertification_issuedById_idx" ON "ScooperCertification" ("issuedById");
CREATE UNIQUE INDEX "ScooperCertification_scooperId_type_key" ON "ScooperCertification" ("scooperId", "type");

CREATE TABLE "ScooperAvailability" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "tileId" TEXT,
  "weekday" INTEGER NOT NULL,
  "window" "AvailabilityWindow" NOT NULL DEFAULT 'FULL',
  "maxStops" INTEGER,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperAvailability_orgId_idx" ON "ScooperAvailability" ("orgId");
CREATE INDEX "ScooperAvailability_scooperId_idx" ON "ScooperAvailability" ("scooperId");
CREATE INDEX "ScooperAvailability_tileId_idx" ON "ScooperAvailability" ("tileId");
CREATE INDEX "ScooperAvailability_weekday_idx" ON "ScooperAvailability" ("weekday");

CREATE TABLE "ScooperDevice" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "platform" TEXT,
  "bluetoothMac" TEXT,
  "status" "ScooperDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperDevice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperDevice_orgId_idx" ON "ScooperDevice" ("orgId");
CREATE INDEX "ScooperDevice_scooperId_idx" ON "ScooperDevice" ("scooperId");
CREATE UNIQUE INDEX "ScooperDevice_orgId_deviceId_key" ON "ScooperDevice" ("orgId", "deviceId");

-- Routing artifacts and job offers
CREATE TABLE "RouteShift" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "tileId" TEXT,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "scheduledWindow" "AvailabilityWindow" NOT NULL,
  "status" "RouteShiftStatus" NOT NULL DEFAULT 'PLANNED',
  "scooperProfileId" TEXT,
  "scooperId" TEXT,
  "backupForShiftId" TEXT,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "plannedStops" INTEGER NOT NULL DEFAULT 0,
  "completedStops" INTEGER NOT NULL DEFAULT 0,
  "plannedMiles" DOUBLE PRECISION,
  "actualMiles" DOUBLE PRECISION,
  "primaryVisitCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RouteShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RouteShift_orgId_serviceDate_idx" ON "RouteShift" ("orgId", "serviceDate");
CREATE INDEX "RouteShift_tileId_idx" ON "RouteShift" ("tileId");
CREATE INDEX "RouteShift_scooperId_idx" ON "RouteShift" ("scooperId");
CREATE INDEX "RouteShift_status_idx" ON "RouteShift" ("status");

CREATE TABLE "VisitOffer" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceVisitId" TEXT NOT NULL,
  "tileId" TEXT,
  "routeShiftId" TEXT,
  "offeredToId" TEXT,
  "status" "VisitOfferStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "dispatchStrategy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitOffer_orgId_idx" ON "VisitOffer" ("orgId");
CREATE INDEX "VisitOffer_serviceVisitId_idx" ON "VisitOffer" ("serviceVisitId");
CREATE INDEX "VisitOffer_tileId_idx" ON "VisitOffer" ("tileId");
CREATE INDEX "VisitOffer_offeredToId_idx" ON "VisitOffer" ("offeredToId");
CREATE INDEX "VisitOffer_status_idx" ON "VisitOffer" ("status");
CREATE INDEX "VisitOffer_expiresAt_idx" ON "VisitOffer" ("expiresAt");

-- Compensation and payouts
CREATE TABLE "VisitCompSchedule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "frequency" "Frequency" NOT NULL,
  "serviceType" "ServiceType",
  "baseRateCents" INTEGER NOT NULL,
  "binDropBonusCents" INTEGER NOT NULL DEFAULT 0,
  "haulAwayBonusCents" INTEGER NOT NULL DEFAULT 0,
  "ecoDiversionBonusCents" INTEGER NOT NULL DEFAULT 0,
  "addonRates" JSONB,
  "certificationMatrix" JSONB,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitCompSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitCompSchedule_orgId_idx" ON "VisitCompSchedule" ("orgId");
CREATE INDEX "VisitCompSchedule_frequency_idx" ON "VisitCompSchedule" ("frequency");
CREATE INDEX "VisitCompSchedule_effectiveFrom_idx" ON "VisitCompSchedule" ("effectiveFrom");

CREATE TABLE "VisitPayout" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceVisitId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "scooperProfileId" TEXT,
  "routeShiftId" TEXT,
  "compScheduleId" TEXT,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "baseAmountCents" INTEGER NOT NULL DEFAULT 0,
  "bonusAmountCents" INTEGER NOT NULL DEFAULT 0,
  "mileageAmountCents" INTEGER NOT NULL DEFAULT 0,
  "ppeAmountCents" INTEGER NOT NULL DEFAULT 0,
  "tipsAmountCents" INTEGER NOT NULL DEFAULT 0,
  "adjustmentsCents" INTEGER NOT NULL DEFAULT 0,
  "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
  "milesDriven" DOUBLE PRECISION,
  "minutesOnSite" INTEGER,
  "qaAuditId" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readyAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitPayout_serviceVisitId_key" ON "VisitPayout" ("serviceVisitId");
CREATE UNIQUE INDEX "VisitPayout_qaAuditId_key" ON "VisitPayout" ("qaAuditId");
CREATE INDEX "VisitPayout_orgId_idx" ON "VisitPayout" ("orgId");
CREATE INDEX "VisitPayout_scooperId_idx" ON "VisitPayout" ("scooperId");
CREATE INDEX "VisitPayout_status_idx" ON "VisitPayout" ("status");
CREATE INDEX "VisitPayout_readyAt_idx" ON "VisitPayout" ("readyAt");
CREATE INDEX "VisitPayout_releasedAt_idx" ON "VisitPayout" ("releasedAt");

CREATE TABLE "ScooperLedgerEntry" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "payoutId" TEXT,
  "sourceVisitId" TEXT,
  "type" "LedgerEntryType" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "notes" TEXT,
  "metadata" JSONB,
  "recordedById" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMP(3),
  CONSTRAINT "ScooperLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScooperLedgerEntry_orgId_idx" ON "ScooperLedgerEntry" ("orgId");
CREATE INDEX "ScooperLedgerEntry_scooperId_idx" ON "ScooperLedgerEntry" ("scooperId");
CREATE INDEX "ScooperLedgerEntry_payoutId_idx" ON "ScooperLedgerEntry" ("payoutId");
CREATE INDEX "ScooperLedgerEntry_type_idx" ON "ScooperLedgerEntry" ("type");

CREATE TABLE "ScooperQaAudit" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceVisitId" TEXT NOT NULL,
  "auditorId" TEXT,
  "outcome" "QaOutcome" NOT NULL DEFAULT 'PASS',
  "score" INTEGER,
  "issues" JSONB,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScooperQaAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScooperQaAudit_serviceVisitId_key" ON "ScooperQaAudit" ("serviceVisitId");
CREATE INDEX "ScooperQaAudit_orgId_idx" ON "ScooperQaAudit" ("orgId");
CREATE INDEX "ScooperQaAudit_auditorId_idx" ON "ScooperQaAudit" ("auditorId");
CREATE INDEX "ScooperQaAudit_outcome_idx" ON "ScooperQaAudit" ("outcome");

-- Foreign keys linking new structures
ALTER TABLE "ServiceTile"
  ADD CONSTRAINT "ServiceTile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceTile_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TileMetricSnapshot"
  ADD CONSTRAINT "TileMetricSnapshot_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TileMetricSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperProfile"
  ADD CONSTRAINT "ScooperProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperCertification"
  ADD CONSTRAINT "ScooperCertification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperCertification_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperCertification_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScooperAvailability"
  ADD CONSTRAINT "ScooperAvailability_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperAvailability_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperAvailability_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScooperDevice"
  ADD CONSTRAINT "ScooperDevice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperDevice_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "ScooperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RouteShift"
  ADD CONSTRAINT "RouteShift_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteShift_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteShift_scooperProfileId_fkey" FOREIGN KEY ("scooperProfileId") REFERENCES "ScooperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteShift_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteShift_backupForShiftId_fkey" FOREIGN KEY ("backupForShiftId") REFERENCES "RouteShift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RouteShift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitOffer"
  ADD CONSTRAINT "VisitOffer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitOffer_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitOffer_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitOffer_routeShiftId_fkey" FOREIGN KEY ("routeShiftId") REFERENCES "RouteShift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitOffer_offeredToId_fkey" FOREIGN KEY ("offeredToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitCompSchedule"
  ADD CONSTRAINT "VisitCompSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitPayout"
  ADD CONSTRAINT "VisitPayout_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_scooperProfileId_fkey" FOREIGN KEY ("scooperProfileId") REFERENCES "ScooperProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_routeShiftId_fkey" FOREIGN KEY ("routeShiftId") REFERENCES "RouteShift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_compScheduleId_fkey" FOREIGN KEY ("compScheduleId") REFERENCES "VisitCompSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VisitPayout_qaAuditId_fkey" FOREIGN KEY ("qaAuditId") REFERENCES "ScooperQaAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScooperLedgerEntry"
  ADD CONSTRAINT "ScooperLedgerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperLedgerEntry_scooperId_fkey" FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperLedgerEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "VisitPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperLedgerEntry_sourceVisitId_fkey" FOREIGN KEY ("sourceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperLedgerEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScooperQaAudit"
  ADD CONSTRAINT "ScooperQaAudit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperQaAudit_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScooperQaAudit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Connect ServiceVisit to new tables
ALTER TABLE "ServiceVisit"
  ADD CONSTRAINT "ServiceVisit_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceVisit_routeShiftId_fkey" FOREIGN KEY ("routeShiftId") REFERENCES "RouteShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Job"
  ADD CONSTRAINT "Job_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "ServiceTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
