-- Add Stripe Connect tracking for scooper payouts
ALTER TABLE "User" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "VisitPayout" ADD COLUMN "stripeTransferId" TEXT;
