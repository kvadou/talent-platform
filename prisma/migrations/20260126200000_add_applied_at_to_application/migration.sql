-- Add appliedAt column to Application table
ALTER TABLE "Application" ADD COLUMN "appliedAt" TIMESTAMP(3);

-- Create index for efficient date filtering
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

-- Backfill appliedAt from createdAt for existing records (will be updated from Greenhouse separately)
UPDATE "Application" SET "appliedAt" = "createdAt" WHERE "appliedAt" IS NULL;
