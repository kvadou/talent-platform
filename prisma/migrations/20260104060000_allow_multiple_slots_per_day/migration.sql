-- Allow multiple availability slots per day (remove unique constraint)
-- Drop the unique constraint on userId + dayOfWeek
DROP INDEX IF EXISTS "RecruiterAvailability_userId_dayOfWeek_key";

-- Add composite index for efficient queries
CREATE INDEX IF NOT EXISTS "RecruiterAvailability_userId_dayOfWeek_idx" ON "RecruiterAvailability"("userId", "dayOfWeek");
