-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Lead_convertedToCustomerId_fkey" FOREIGN KEY ("convertedToCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_submittedAt_idx" ON "Lead"("submittedAt");

-- CreateIndex
CREATE INDEX "Lead_zipCode_idx" ON "Lead"("zipCode");
