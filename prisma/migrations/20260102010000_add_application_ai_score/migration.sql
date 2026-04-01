-- Add AI scoring fields to Application
ALTER TABLE "Application" ADD COLUMN "aiScore" INTEGER;
ALTER TABLE "Application" ADD COLUMN "aiScoreBreakdown" JSONB;
ALTER TABLE "Application" ADD COLUMN "aiScoredAt" TIMESTAMP(3);

-- Create index for sorting by score
CREATE INDEX "Application_aiScore_idx" ON "Application"("aiScore");
