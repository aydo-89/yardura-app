/*
  Warnings:

  - Added the required column `orgId` to the `Lead` table without a default value. This is not possible if the table is not empty.

*/
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
    CONSTRAINT "Lead_convertedToCustomerId_fkey" FOREIGN KEY ("convertedToCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("address", "areasToClean", "businessName", "businessType", "city", "convertedAt", "convertedToCustomerId", "daysSinceLastCleanup", "deodorize", "deodorizeMode", "divertMode", "dogs", "email", "estimatedPrice", "firstName", "frequency", "id", "initialClean", "ipAddress", "lastCleanedBucket", "lastCleanedDate", "lastName", "latitude", "longitude", "orgId", "phone", "preferredContactMethod", "pricingBreakdown", "priority", "protectionScore", "recaptchaToken", "referralSource", "salesRepId", "serviceType", "source", "specialInstructions", "sprayDeck", "sprayDeckMode", "state", "status", "submittedAt", "updatedAt", "userAgent", "wellnessOptIn", "yardSize", "zipCode") SELECT "address", "areasToClean", "businessName", "businessType", "city", "convertedAt", "convertedToCustomerId", "daysSinceLastCleanup", "deodorize", "deodorizeMode", "divertMode", "dogs", "email", "estimatedPrice", "firstName", "frequency", "id", "initialClean", "ipAddress", "lastCleanedBucket", "lastCleanedDate", "lastName", "latitude", "longitude", 'yardura', "phone", "preferredContactMethod", "pricingBreakdown", "priority", "protectionScore", "recaptchaToken", "referralSource", "salesRepId", "serviceType", "source", "specialInstructions", "sprayDeck", "sprayDeckMode", "state", "status", "submittedAt", "updatedAt", "userAgent", "wellnessOptIn", "yardSize", "zipCode" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_orgId_idx" ON "Lead"("orgId");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_submittedAt_idx" ON "Lead"("submittedAt");
CREATE INDEX "Lead_zipCode_idx" ON "Lead"("zipCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
