-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailTemplateScope" AS ENUM ('GLOBAL', 'JOB', 'STAGE');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchedulingLinkStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobId" TEXT,
    "stageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaConfig" (
    "id" TEXT NOT NULL,
    "stageId" TEXT,
    "jobId" TEXT,
    "targetDays" INTEGER NOT NULL DEFAULT 3,
    "warningDays" INTEGER NOT NULL DEFAULT 2,
    "isGlobalDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaBreach" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "slaConfigId" TEXT NOT NULL,
    "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scope" "EmailTemplateScope" NOT NULL DEFAULT 'GLOBAL',
    "jobId" TEXT,
    "stageId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "mergeFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageRule" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "emailTemplateId" TEXT,
    "taskTemplate" JSONB,
    "slaOverride" JSONB,
    "tags" TEXT[],
    "sequenceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceInstance" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingLink" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "interviewerIds" TEXT[],
    "duration" INTEGER NOT NULL DEFAULT 30,
    "bufferBefore" INTEGER NOT NULL DEFAULT 15,
    "bufferAfter" INTEGER NOT NULL DEFAULT 15,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxDaysOut" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT DEFAULT 'America/Chicago',
    "status" "SchedulingLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_applicationId_idx" ON "Task"("applicationId");

-- CreateIndex
CREATE INDEX "Task_jobId_idx" ON "Task"("jobId");

-- CreateIndex
CREATE INDEX "Task_stageId_idx" ON "Task"("stageId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "SlaConfig_stageId_idx" ON "SlaConfig"("stageId");

-- CreateIndex
CREATE INDEX "SlaConfig_jobId_idx" ON "SlaConfig"("jobId");

-- CreateIndex
CREATE INDEX "SlaBreach_applicationId_idx" ON "SlaBreach"("applicationId");

-- CreateIndex
CREATE INDEX "SlaBreach_breachedAt_idx" ON "SlaBreach"("breachedAt");

-- CreateIndex
CREATE INDEX "EmailTemplate_scope_idx" ON "EmailTemplate"("scope");

-- CreateIndex
CREATE INDEX "EmailTemplate_jobId_idx" ON "EmailTemplate"("jobId");

-- CreateIndex
CREATE INDEX "EmailTemplate_stageId_idx" ON "EmailTemplate"("stageId");

-- CreateIndex
CREATE INDEX "StageRule_stageId_idx" ON "StageRule"("stageId");

-- CreateIndex
CREATE INDEX "StageRule_isActive_idx" ON "StageRule"("isActive");

-- CreateIndex
CREATE INDEX "SequenceInstance_applicationId_idx" ON "SequenceInstance"("applicationId");

-- CreateIndex
CREATE INDEX "SequenceInstance_sequenceId_idx" ON "SequenceInstance"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceInstance_status_idx" ON "SequenceInstance"("status");

-- CreateIndex
CREATE INDEX "SequenceInstance_nextSendAt_idx" ON "SequenceInstance"("nextSendAt");

-- CreateIndex
CREATE INDEX "SchedulingLink_applicationId_idx" ON "SchedulingLink"("applicationId");

-- CreateIndex
CREATE INDEX "SchedulingLink_stageId_idx" ON "SchedulingLink"("stageId");

-- CreateIndex
CREATE INDEX "SchedulingLink_token_idx" ON "SchedulingLink"("token");

-- CreateIndex
CREATE INDEX "SchedulingLink_status_idx" ON "SchedulingLink"("status");

-- CreateIndex
CREATE INDEX "CalendarIntegration_userId_idx" ON "CalendarIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaConfig_stageId_key" ON "SlaConfig"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingLink_token_key" ON "SchedulingLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_userId_provider_key" ON "CalendarIntegration"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaConfig" ADD CONSTRAINT "SlaConfig_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaConfig" ADD CONSTRAINT "SlaConfig_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaBreach" ADD CONSTRAINT "SlaBreach_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaBreach" ADD CONSTRAINT "SlaBreach_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "SlaConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRule" ADD CONSTRAINT "StageRule_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRule" ADD CONSTRAINT "StageRule_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageRule" ADD CONSTRAINT "StageRule_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceInstance" ADD CONSTRAINT "SequenceInstance_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingLink" ADD CONSTRAINT "SchedulingLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingLink" ADD CONSTRAINT "SchedulingLink_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
