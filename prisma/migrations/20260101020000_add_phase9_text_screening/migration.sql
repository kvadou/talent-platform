-- Phase 9: Async Text Screening
-- AI conducts initial screening via text before human phone screen

-- Create enums for screening types
CREATE TYPE "ScreeningType" AS ENUM ('TEXT_SMS', 'TEXT_CHAT', 'TEXT_EMAIL', 'VOICE_ASYNC');

CREATE TYPE "ScreeningStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'AWAITING_RESPONSE', 'COMPLETED', 'EXPIRED', 'HUMAN_TAKEOVER');

CREATE TYPE "ScreeningDecision" AS ENUM ('ADVANCE', 'SCHEDULE_CALL', 'REJECT', 'HOLD');

CREATE TYPE "ScreeningQuestionType" AS ENUM ('OPEN_ENDED', 'MULTIPLE_CHOICE', 'YES_NO', 'AVAILABILITY', 'SALARY_EXPECTATION');

CREATE TYPE "ScreeningMessageRole" AS ENUM ('AI', 'CANDIDATE', 'SYSTEM', 'RECRUITER');

-- Create ScreeningQuestionSet table (must be created before AIScreeningSession due to FK)
CREATE TABLE "ScreeningQuestionSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jobId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningQuestionSet_pkey" PRIMARY KEY ("id")
);

-- Create ScreeningQuestion table
CREATE TABLE "ScreeningQuestion" (
    "id" TEXT NOT NULL,
    "questionSetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "questionType" "ScreeningQuestionType" NOT NULL,
    "options" JSONB,
    "isKnockout" BOOLEAN NOT NULL DEFAULT false,
    "knockoutAnswer" TEXT,
    "knockoutMessage" TEXT,
    "evaluationPrompt" TEXT,
    "minAcceptableScore" INTEGER,
    "conditionalFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpCondition" JSONB,
    "followUpQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningQuestion_pkey" PRIMARY KEY ("id")
);

-- Create AIScreeningSession table
CREATE TABLE "AIScreeningSession" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "ScreeningType" NOT NULL,
    "status" "ScreeningStatus" NOT NULL DEFAULT 'PENDING',
    "questionSetId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "aiScore" INTEGER,
    "aiRecommendation" "ScreeningDecision",
    "aiNotes" TEXT,
    "knockoutTriggered" BOOLEAN NOT NULL DEFAULT false,
    "knockoutReason" TEXT,
    "humanReviewerId" TEXT,
    "humanDecision" "ScreeningDecision",
    "humanNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIScreeningSession_pkey" PRIMARY KEY ("id")
);

-- Create ScreeningMessage table
CREATE TABLE "ScreeningMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ScreeningMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "questionId" TEXT,
    "questionOrder" INTEGER,
    "aiAnalysis" TEXT,
    "aiScore" INTEGER,
    "audioUrl" TEXT,
    "transcript" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "deliveryError" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningMessage_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ScreeningQuestionSet_jobId_idx" ON "ScreeningQuestionSet"("jobId");
CREATE INDEX "ScreeningQuestionSet_isDefault_idx" ON "ScreeningQuestionSet"("isDefault");

CREATE INDEX "ScreeningQuestion_questionSetId_idx" ON "ScreeningQuestion"("questionSetId");
CREATE INDEX "ScreeningQuestion_order_idx" ON "ScreeningQuestion"("order");

CREATE INDEX "AIScreeningSession_applicationId_idx" ON "AIScreeningSession"("applicationId");
CREATE INDEX "AIScreeningSession_status_idx" ON "AIScreeningSession"("status");
CREATE INDEX "AIScreeningSession_questionSetId_idx" ON "AIScreeningSession"("questionSetId");
CREATE INDEX "AIScreeningSession_aiScore_idx" ON "AIScreeningSession"("aiScore");

CREATE INDEX "ScreeningMessage_sessionId_idx" ON "ScreeningMessage"("sessionId");
CREATE INDEX "ScreeningMessage_role_idx" ON "ScreeningMessage"("role");
CREATE INDEX "ScreeningMessage_sentAt_idx" ON "ScreeningMessage"("sentAt");

-- Add foreign key constraints
ALTER TABLE "ScreeningQuestionSet" ADD CONSTRAINT "ScreeningQuestionSet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScreeningQuestion" ADD CONSTRAINT "ScreeningQuestion_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "ScreeningQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIScreeningSession" ADD CONSTRAINT "AIScreeningSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIScreeningSession" ADD CONSTRAINT "AIScreeningSession_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "ScreeningQuestionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIScreeningSession" ADD CONSTRAINT "AIScreeningSession_humanReviewerId_fkey" FOREIGN KEY ("humanReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScreeningMessage" ADD CONSTRAINT "ScreeningMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AIScreeningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
