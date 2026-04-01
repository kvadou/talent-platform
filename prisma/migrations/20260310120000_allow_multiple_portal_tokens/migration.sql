-- DropIndex
DROP INDEX IF EXISTS "ApplicationToken_applicationId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationToken_applicationId_idx" ON "ApplicationToken"("applicationId");
