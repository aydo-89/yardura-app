-- Add appleId field to User table for Sign in with Apple
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;

-- Create unique index on appleId
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
