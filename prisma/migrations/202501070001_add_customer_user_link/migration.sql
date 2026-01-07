-- Add optional userId column to link customers with users
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Ensure the relationship remains one-to-one when present
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_userId_key" ON "Customer"("userId");

-- Establish the foreign key constraint to users (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Customer_userId_fkey'
  ) THEN
    ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
