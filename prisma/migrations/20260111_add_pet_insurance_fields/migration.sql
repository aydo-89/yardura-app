-- Add pet insurance fields to Dog model
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "insuranceProvider" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "insurancePolicyNumber" TEXT;
ALTER TABLE "Dog" ADD COLUMN IF NOT EXISTS "insurancePhone" TEXT;
