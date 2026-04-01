-- AlterTable
ALTER TABLE "BackgroundCheck" ADD COLUMN "checkrInvitationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundCheck_checkrInvitationId_key" ON "BackgroundCheck"("checkrInvitationId");

-- CreateIndex
CREATE INDEX "BackgroundCheck_checkrInvitationId_idx" ON "BackgroundCheck"("checkrInvitationId");
