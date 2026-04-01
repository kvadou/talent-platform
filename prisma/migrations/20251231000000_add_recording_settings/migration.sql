-- Add recording settings to Interview and Job models
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "recordingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "defaultRecordingEnabled" BOOLEAN NOT NULL DEFAULT true;
