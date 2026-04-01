-- Phase 7: Learning Foundation
-- Add HiringOutcome and AIRecommendationFeedback models

-- Remove public sharing fields from InterviewClip
ALTER TABLE "InterviewClip" DROP COLUMN IF EXISTS "shareToken";
ALTER TABLE "InterviewClip" DROP COLUMN IF EXISTS "isPublic";
ALTER TABLE "InterviewClip" DROP COLUMN IF EXISTS "expiresAt";

-- Drop the shareToken unique index if it exists
DROP INDEX IF EXISTS "InterviewClip_shareToken_key";
DROP INDEX IF EXISTS "InterviewClip_shareToken_idx";

-- Create HiringOutcome table
CREATE TABLE "HiringOutcome" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "wasHired" BOOLEAN NOT NULL,
    "hireDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "stillEmployedAt30Days" BOOLEAN,
    "stillEmployedAt90Days" BOOLEAN,
    "stillEmployedAt180Days" BOOLEAN,
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "performanceRating" INTEGER,
    "performanceNotes" TEXT,
    "rejectionRegret" BOOLEAN NOT NULL DEFAULT false,
    "regretNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringOutcome_pkey" PRIMARY KEY ("id")
);

-- Create AIRecommendationFeedback table
CREATE TABLE "AIRecommendationFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "aiRecommendation" TEXT NOT NULL,
    "aiScore" INTEGER NOT NULL,
    "humanRecommendation" TEXT,
    "humanScore" INTEGER,
    "wasAIHelpful" BOOLEAN,
    "feedbackType" TEXT,
    "feedbackNotes" TEXT,
    "incorrectStrengths" JSONB,
    "missedStrengths" JSONB,
    "incorrectConcerns" JSONB,
    "missedConcerns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- Create unique index for HiringOutcome
CREATE UNIQUE INDEX "HiringOutcome_applicationId_key" ON "HiringOutcome"("applicationId");

-- Create indexes for HiringOutcome
CREATE INDEX "HiringOutcome_wasHired_idx" ON "HiringOutcome"("wasHired");
CREATE INDEX "HiringOutcome_createdAt_idx" ON "HiringOutcome"("createdAt");

-- Create indexes for AIRecommendationFeedback
CREATE INDEX "AIRecommendationFeedback_interviewId_idx" ON "AIRecommendationFeedback"("interviewId");
CREATE INDEX "AIRecommendationFeedback_feedbackType_idx" ON "AIRecommendationFeedback"("feedbackType");

-- Add foreign keys
ALTER TABLE "HiringOutcome" ADD CONSTRAINT "HiringOutcome_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIRecommendationFeedback" ADD CONSTRAINT "AIRecommendationFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
