-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('SCALE', 'BOOLEAN', 'TEXT');

-- CreateEnum
CREATE TYPE "HireRecommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('CAREER_PAGE', 'LINKEDIN', 'INDEED', 'REFERRAL', 'AGENCY', 'OTHER');

-- AlterTable Candidate - Add source tracking
ALTER TABLE "Candidate" ADD COLUMN "source" "CandidateSource" DEFAULT 'CAREER_PAGE';
ALTER TABLE "Candidate" ADD COLUMN "sourceDetails" TEXT;

-- AlterTable Interview - Add scorecard and tracking fields
ALTER TABLE "Interview" ADD COLUMN "scorecardId" TEXT;
ALTER TABLE "Interview" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Interview" ADD COLUMN "confirmationSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Interview" ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable MessageLog - Add email tracking
ALTER TABLE "MessageLog" ADD COLUMN "postmarkMessageId" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "openedAt" TIMESTAMP(3);
ALTER TABLE "MessageLog" ADD COLUMN "clickedAt" TIMESTAMP(3);
ALTER TABLE "MessageLog" ADD COLUMN "bouncedAt" TIMESTAMP(3);

-- CreateTable InterviewScorecard
CREATE TABLE "InterviewScorecard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "InterviewType" NOT NULL,
    "criteria" JSONB NOT NULL,
    "jobId" TEXT,
    "organizationId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable InterviewFeedback
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "recommendation" "HireRecommendation",
    "strengths" TEXT,
    "weaknesses" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable Offer
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "equity" TEXT,
    "bonus" DECIMAL(65,30),
    "benefits" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "letterUrl" TEXT,
    "signedUrl" TEXT,
    "declineReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable OfferApproval
CREATE TABLE "OfferApproval" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_source_idx" ON "Candidate"("source");

-- CreateIndex
CREATE INDEX "Interview_scorecardId_idx" ON "Interview"("scorecardId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_postmarkMessageId_key" ON "MessageLog"("postmarkMessageId");

-- CreateIndex
CREATE INDEX "MessageLog_postmarkMessageId_idx" ON "MessageLog"("postmarkMessageId");

-- CreateIndex
CREATE INDEX "InterviewScorecard_jobId_idx" ON "InterviewScorecard"("jobId");

-- CreateIndex
CREATE INDEX "InterviewScorecard_organizationId_idx" ON "InterviewScorecard"("organizationId");

-- CreateIndex
CREATE INDEX "InterviewScorecard_type_idx" ON "InterviewScorecard"("type");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewId_idx" ON "InterviewFeedback"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_userId_idx" ON "InterviewFeedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_applicationId_key" ON "Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_applicationId_idx" ON "Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_jobId_idx" ON "Offer"("jobId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "OfferApproval_offerId_idx" ON "OfferApproval"("offerId");

-- CreateIndex
CREATE INDEX "OfferApproval_userId_idx" ON "OfferApproval"("userId");

-- CreateIndex
CREATE INDEX "OfferApproval_status_idx" ON "OfferApproval"("status");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "InterviewScorecard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewScorecard" ADD CONSTRAINT "InterviewScorecard_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
