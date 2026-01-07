-- Add dog count to jobs so service plans can track covered pets.
ALTER TABLE "Job" ADD COLUMN "dogCount" INTEGER;
