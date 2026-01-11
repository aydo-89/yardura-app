-- Convert all existing DRAFT tiles to WAITLIST
UPDATE "ServiceTile" SET status = 'WAITLIST' WHERE status = 'DRAFT';

-- Remove DRAFT from ServiceTileStatus enum
-- First create a new enum type without DRAFT
CREATE TYPE "ServiceTileStatus_new" AS ENUM ('WAITLIST', 'LIVE', 'SUSPENDED');

-- Update the column to use the new enum type
ALTER TABLE "ServiceTile" ALTER COLUMN status TYPE "ServiceTileStatus_new" USING (status::text::"ServiceTileStatus_new");

-- Drop the old enum type
DROP TYPE "ServiceTileStatus";

-- Rename the new enum type to the original name
ALTER TYPE "ServiceTileStatus_new" RENAME TO "ServiceTileStatus";
