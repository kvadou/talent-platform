/*
  Warnings:

  - Made the column `createdAt` on table `Application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Application` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Candidate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Candidate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `importedToContractors` on table `Candidate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `IntegrationToken` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `IntegrationToken` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Interview` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Interview` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Job` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Job` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Market` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Market` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sentAt` on table `MessageLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isPrivate` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Note` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Organization` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Organization` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isDefault` on table `Stage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Stage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Stage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `movedAt` on table `StageHistory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `UserMarket` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_jobId_fkey";

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_stageId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_interviewerId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_marketId_fkey";

-- DropForeignKey
ALTER TABLE "Market" DROP CONSTRAINT "Market_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Stage" DROP CONSTRAINT "Stage_jobId_fkey";

-- DropForeignKey
ALTER TABLE "StageHistory" DROP CONSTRAINT "StageHistory_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "StageHistory" DROP CONSTRAINT "StageHistory_stageId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "UserMarket" DROP CONSTRAINT "UserMarket_marketId_fkey";

-- DropForeignKey
ALTER TABLE "UserMarket" DROP CONSTRAINT "UserMarket_userId_fkey";

-- AlterTable
ALTER TABLE "Application" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Candidate" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "importedToContractors" SET NOT NULL,
ALTER COLUMN "importedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IntegrationToken" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Interview" ALTER COLUMN "scheduledAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Market" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MessageLog" ALTER COLUMN "sentAt" SET NOT NULL,
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "isPrivate" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Stage" ALTER COLUMN "isDefault" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StageHistory" ALTER COLUMN "movedAt" SET NOT NULL,
ALTER COLUMN "movedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserMarket" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMarket" ADD CONSTRAINT "UserMarket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMarket" ADD CONSTRAINT "UserMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageHistory" ADD CONSTRAINT "StageHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageHistory" ADD CONSTRAINT "StageHistory_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Application_candidate_idx" RENAME TO "Application_candidateId_idx";

-- RenameIndex
ALTER INDEX "Application_job_idx" RENAME TO "Application_jobId_idx";

-- RenameIndex
ALTER INDEX "Application_stage_idx" RENAME TO "Application_stageId_idx";

-- RenameIndex
ALTER INDEX "Interview_app_idx" RENAME TO "Interview_applicationId_idx";

-- RenameIndex
ALTER INDEX "Interview_scheduled_idx" RENAME TO "Interview_scheduledAt_idx";

-- RenameIndex
ALTER INDEX "Job_market_idx" RENAME TO "Job_marketId_idx";

-- RenameIndex
ALTER INDEX "MessageLog_app_idx" RENAME TO "MessageLog_applicationId_idx";

-- RenameIndex
ALTER INDEX "MessageLog_sent_idx" RENAME TO "MessageLog_sentAt_idx";

-- RenameIndex
ALTER INDEX "Note_app_idx" RENAME TO "Note_applicationId_idx";

-- RenameIndex
ALTER INDEX "Note_created_idx" RENAME TO "Note_createdAt_idx";

-- RenameIndex
ALTER INDEX "Stage_job_idx" RENAME TO "Stage_jobId_idx";

-- RenameIndex
ALTER INDEX "StageHistory_app_idx" RENAME TO "StageHistory_applicationId_idx";

-- RenameIndex
ALTER INDEX "UserMarket_market_idx" RENAME TO "UserMarket_marketId_idx";
