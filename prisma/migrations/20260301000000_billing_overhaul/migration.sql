-- Create tables for new billing plan and ledger
CREATE TABLE "CustomerBillingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "billingPreference" TEXT NOT NULL,
    "stripeScheduleId" TEXT,
    "stripeSubscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "firstChargeAmountCents" INTEGER,
    "recurringAmountCents" INTEGER,
    "perVisitAmountCents" INTEGER,
    "pricingSnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerBillingPlan_jobId_key" UNIQUE ("jobId"),
    CONSTRAINT "CustomerBillingPlan_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerBillingPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerBillingPlan_orgId_idx" ON "CustomerBillingPlan"("orgId");
CREATE INDEX "CustomerBillingPlan_customerId_idx" ON "CustomerBillingPlan"("customerId");
CREATE INDEX "CustomerBillingPlan_stripeScheduleId_idx" ON "CustomerBillingPlan"("stripeScheduleId");
CREATE INDEX "CustomerBillingPlan_stripeSubscriptionId_idx" ON "CustomerBillingPlan"("stripeSubscriptionId");

CREATE TYPE "BillingLedgerEntryType" AS ENUM ('CHARGE', 'CREDIT', 'ADJUSTMENT');
CREATE TYPE "BillingLedgerEntryStatus" AS ENUM ('PENDING', 'APPLIED', 'VOID');

CREATE TABLE "CustomerBillingLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceVisitId" TEXT,
    "type" "BillingLedgerEntryType" NOT NULL,
    "status" "BillingLedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "stripeInvoiceId" TEXT,
    "stripeInvoiceItemId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerBillingLedgerEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerBillingLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerBillingLedgerEntry_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CustomerBillingLedgerEntry_orgId_idx" ON "CustomerBillingLedgerEntry"("orgId");
CREATE INDEX "CustomerBillingLedgerEntry_customerId_idx" ON "CustomerBillingLedgerEntry"("customerId");
CREATE INDEX "CustomerBillingLedgerEntry_jobId_idx" ON "CustomerBillingLedgerEntry"("jobId");
CREATE INDEX "CustomerBillingLedgerEntry_serviceVisitId_idx" ON "CustomerBillingLedgerEntry"("serviceVisitId");
CREATE INDEX "CustomerBillingLedgerEntry_type_status_idx" ON "CustomerBillingLedgerEntry"("type", "status");
CREATE INDEX "CustomerBillingLedgerEntry_stripeInvoiceId_idx" ON "CustomerBillingLedgerEntry"("stripeInvoiceId");
