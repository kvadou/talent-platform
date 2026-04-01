-- Add auto-advance fields to Job table
ALTER TABLE "Job" ADD COLUMN "autoAdvanceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN "autoAdvanceMinScore" INTEGER NOT NULL DEFAULT 85;
ALTER TABLE "Job" ADD COLUMN "autoAdvanceToStageId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Job" ADD CONSTRAINT "Job_autoAdvanceToStageId_fkey" FOREIGN KEY ("autoAdvanceToStageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
