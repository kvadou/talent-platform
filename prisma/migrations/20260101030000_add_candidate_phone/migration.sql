-- Add candidate phone field for SMS screening sessions
ALTER TABLE "AIScreeningSession" ADD COLUMN "candidatePhone" TEXT;

-- Create index for phone lookups
CREATE INDEX "AIScreeningSession_candidatePhone_idx" ON "AIScreeningSession"("candidatePhone");
