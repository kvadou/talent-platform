ALTER TABLE "ApplicationToken"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Application_candidateId_jobId_key"
ON "Application"("candidateId", "jobId");

CREATE UNIQUE INDEX IF NOT EXISTS "Job_requisitionId_key"
ON "Job"("requisitionId");
