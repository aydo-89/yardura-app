-- Add multi-role support for users
ALTER TABLE "User" ADD COLUMN "roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[];
