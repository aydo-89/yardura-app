-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT,
    "geometry" JSONB NOT NULL,
    "parentId" TEXT,
    "priorityWeight" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Territory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Territory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TerritoryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TerritoryAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TerritoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,
    "notes" TEXT,
    "location" JSONB,
    "attachments" JSONB,
    "durationSecs" INTEGER,
    "followUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadActivity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cadence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetStage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cadence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CadenceStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cadenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT,
    "waitMinutes" INTEGER NOT NULL DEFAULT 0,
    "slaMinutes" INTEGER,
    "autoComplete" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    CONSTRAINT "CadenceStep_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "Cadence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadCadenceEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastExecutedAt" DATETIME,
    "nextRunAt" DATETIME,
    "pausedAt" DATETIME,
    "cancelledAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "LeadCadenceEnrollment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadCadenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadCadenceEnrollment_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "Cadence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadCadenceEnrollment_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "CadenceStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "territoryId" TEXT,
    "name" TEXT,
    "optimization" TEXT NOT NULL DEFAULT 'fastest',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "plannedStart" DATETIME,
    "startLocation" JSONB NOT NULL,
    "endLocation" JSONB,
    "distanceMeters" INTEGER,
    "durationMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "leadId" TEXT,
    "order" INTEGER NOT NULL,
    "plannedAt" DATETIME,
    "arrivalAt" DATETIME,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "address" TEXT,
    "location" JSONB,
    CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripStop_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProspectImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "stats" JSONB,
    "fileUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "ProspectImport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProspectImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "leadType" TEXT NOT NULL DEFAULT 'inbound',
    "pipelineStage" TEXT,
    "territoryId" TEXT,
    "campaignId" TEXT,
    "createdById" TEXT,
    "ownerId" TEXT,
    "lastActivityAt" DATETIME,
    "nextActionAt" DATETIME,
    "lastActivityId" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'residential',
    "dogs" INTEGER,
    "yardSize" TEXT,
    "frequency" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "businessType" TEXT,
    "businessName" TEXT,
    "deodorize" BOOLEAN NOT NULL DEFAULT false,
    "deodorizeMode" TEXT,
    "sprayDeck" BOOLEAN NOT NULL DEFAULT false,
    "sprayDeckMode" TEXT,
    "divertMode" TEXT,
    "areasToClean" JSONB,
    "lastCleanedBucket" TEXT,
    "lastCleanedDate" DATETIME,
    "initialClean" BOOLEAN NOT NULL DEFAULT false,
    "daysSinceLastCleanup" INTEGER,
    "specialInstructions" TEXT,
    "referralSource" TEXT,
    "preferredContactMethod" TEXT,
    "wellnessOptIn" BOOLEAN NOT NULL DEFAULT false,
    "estimatedPrice" REAL,
    "pricingBreakdown" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'website',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "convertedAt" DATETIME,
    "convertedToCustomerId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "protectionScore" REAL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "recaptchaToken" TEXT,
    "salesRepId" TEXT,
    CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lead_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_lastActivityId_fkey" FOREIGN KEY ("lastActivityId") REFERENCES "LeadActivity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_convertedToCustomerId_fkey" FOREIGN KEY ("convertedToCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("address", "areasToClean", "businessName", "businessType", "city", "convertedAt", "convertedToCustomerId", "daysSinceLastCleanup", "deodorize", "deodorizeMode", "divertMode", "dogs", "email", "estimatedPrice", "firstName", "frequency", "id", "initialClean", "ipAddress", "lastCleanedBucket", "lastCleanedDate", "lastName", "latitude", "longitude", "orgId", "phone", "preferredContactMethod", "pricingBreakdown", "priority", "protectionScore", "recaptchaToken", "referralSource", "salesRepId", "serviceType", "source", "specialInstructions", "sprayDeck", "sprayDeckMode", "state", "status", "submittedAt", "updatedAt", "userAgent", "wellnessOptIn", "yardSize", "zipCode") SELECT "address", "areasToClean", "businessName", "businessType", "city", "convertedAt", "convertedToCustomerId", "daysSinceLastCleanup", "deodorize", "deodorizeMode", "divertMode", "dogs", "email", "estimatedPrice", "firstName", "frequency", "id", "initialClean", "ipAddress", "lastCleanedBucket", "lastCleanedDate", "lastName", "latitude", "longitude", "orgId", "phone", "preferredContactMethod", "pricingBreakdown", "priority", "protectionScore", "recaptchaToken", "referralSource", "salesRepId", "serviceType", "source", "specialInstructions", "sprayDeck", "sprayDeckMode", "state", "status", "submittedAt", "updatedAt", "userAgent", "wellnessOptIn", "yardSize", "zipCode" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_lastActivityId_key" ON "Lead"("lastActivityId");
CREATE INDEX "Lead_orgId_idx" ON "Lead"("orgId");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_submittedAt_idx" ON "Lead"("submittedAt");
CREATE INDEX "Lead_zipCode_idx" ON "Lead"("zipCode");
CREATE INDEX "Lead_leadType_idx" ON "Lead"("leadType");
CREATE INDEX "Lead_pipelineStage_idx" ON "Lead"("pipelineStage");
CREATE INDEX "Lead_territoryId_idx" ON "Lead"("territoryId");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX "Lead_nextActionAt_idx" ON "Lead"("nextActionAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Territory_slug_key" ON "Territory"("slug");

-- CreateIndex
CREATE INDEX "Territory_orgId_idx" ON "Territory"("orgId");

-- CreateIndex
CREATE INDEX "Territory_parentId_idx" ON "Territory"("parentId");

-- CreateIndex
CREATE INDEX "TerritoryAssignment_orgId_idx" ON "TerritoryAssignment"("orgId");

-- CreateIndex
CREATE INDEX "TerritoryAssignment_territoryId_idx" ON "TerritoryAssignment"("territoryId");

-- CreateIndex
CREATE INDEX "TerritoryAssignment_userId_idx" ON "TerritoryAssignment"("userId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_occurredAt_idx" ON "LeadActivity"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "LeadActivity_orgId_occurredAt_idx" ON "LeadActivity"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "Cadence_orgId_idx" ON "Cadence"("orgId");

-- CreateIndex
CREATE INDEX "Cadence_orgId_targetStage_idx" ON "Cadence"("orgId", "targetStage");

-- CreateIndex
CREATE INDEX "CadenceStep_cadenceId_order_idx" ON "CadenceStep"("cadenceId", "order");

-- CreateIndex
CREATE INDEX "LeadCadenceEnrollment_orgId_idx" ON "LeadCadenceEnrollment"("orgId");

-- CreateIndex
CREATE INDEX "LeadCadenceEnrollment_leadId_idx" ON "LeadCadenceEnrollment"("leadId");

-- CreateIndex
CREATE INDEX "LeadCadenceEnrollment_cadenceId_idx" ON "LeadCadenceEnrollment"("cadenceId");

-- CreateIndex
CREATE INDEX "LeadCadenceEnrollment_status_idx" ON "LeadCadenceEnrollment"("status");

-- CreateIndex
CREATE INDEX "LeadCadenceEnrollment_nextRunAt_idx" ON "LeadCadenceEnrollment"("nextRunAt");

-- CreateIndex
CREATE INDEX "Trip_orgId_idx" ON "Trip"("orgId");

-- CreateIndex
CREATE INDEX "Trip_ownerId_idx" ON "Trip"("ownerId");

-- CreateIndex
CREATE INDEX "Trip_territoryId_idx" ON "Trip"("territoryId");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "TripStop_tripId_order_idx" ON "TripStop"("tripId", "order");

-- CreateIndex
CREATE INDEX "TripStop_leadId_idx" ON "TripStop"("leadId");

-- CreateIndex
CREATE INDEX "ProspectImport_orgId_idx" ON "ProspectImport"("orgId");

-- CreateIndex
CREATE INDEX "ProspectImport_status_idx" ON "ProspectImport"("status");
