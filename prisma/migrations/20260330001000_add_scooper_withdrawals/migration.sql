-- Scooper withdrawals and payout settings
CREATE TYPE "ScooperWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

ALTER TABLE "ScooperProfile" ADD COLUMN "payoutAutoReleaseEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "VisitPayout" ADD COLUMN "withdrawalRequestId" TEXT;

CREATE TABLE "ScooperWithdrawalRequest" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scooperId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "ScooperWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "paidAt" TIMESTAMP(3),
  "stripeTransferId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScooperWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_scooperId_fkey"
  FOREIGN KEY ("scooperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScooperWithdrawalRequest" ADD CONSTRAINT "ScooperWithdrawalRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitPayout" ADD CONSTRAINT "VisitPayout_withdrawalRequestId_fkey"
  FOREIGN KEY ("withdrawalRequestId") REFERENCES "ScooperWithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "VisitPayout_withdrawalRequestId_idx" ON "VisitPayout"("withdrawalRequestId");
CREATE INDEX "ScooperWithdrawalRequest_orgId_idx" ON "ScooperWithdrawalRequest"("orgId");
CREATE INDEX "ScooperWithdrawalRequest_scooperId_idx" ON "ScooperWithdrawalRequest"("scooperId");
CREATE INDEX "ScooperWithdrawalRequest_status_idx" ON "ScooperWithdrawalRequest"("status");
