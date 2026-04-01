-- Add AI Tools settings to Organization
ALTER TABLE "Organization" ADD COLUMN "aiEmailEditor" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "aiInterviewQuestions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "aiJobNoteSummaries" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "aiJobDescriptions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "aiKeywordSuggestions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "aiOfferForecast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "aiReportBuilder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "aiScorecardSuggestions" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "ApprovalWorkflowType" AS ENUM ('JOB_APPROVAL', 'OFFER_APPROVAL');

-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('TEXT', 'TEXTAREA', 'SELECT', 'MULTI_SELECT', 'RATING', 'YES_NO');

-- CreateTable: Agency
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "website" TEXT,
    "feePercentage" DECIMAL(5,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AgencyRecruiter
CREATE TABLE "AgencyRecruiter" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyRecruiter_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AgencyCandidate
CREATE TABLE "AgencyCandidate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "recruiterId" TEXT,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiredAt" TIMESTAMP(3),
    "fee" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AgencyJobAssignment
CREATE TABLE "AgencyJobAssignment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyJobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApprovalWorkflow
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "type" "ApprovalWorkflowType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApprovalWorkflowStep
CREATE TABLE "ApprovalWorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverIds" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OfferTemplate
CREATE TABLE "OfferTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "mergeTokens" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CandidateSurvey
CREATE TABLE "CandidateSurvey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "triggerEvent" TEXT DEFAULT 'after_application',
    "delayHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SurveyQuestion
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SurveyResponse
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "token" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SurveyAnswer
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "AgencyRecruiter_agencyId_idx" ON "AgencyRecruiter"("agencyId");
CREATE INDEX "AgencyRecruiter_email_idx" ON "AgencyRecruiter"("email");

CREATE UNIQUE INDEX "AgencyCandidate_agencyId_candidateId_jobId_key" ON "AgencyCandidate"("agencyId", "candidateId", "jobId");
CREATE INDEX "AgencyCandidate_agencyId_idx" ON "AgencyCandidate"("agencyId");
CREATE INDEX "AgencyCandidate_recruiterId_idx" ON "AgencyCandidate"("recruiterId");
CREATE INDEX "AgencyCandidate_candidateId_idx" ON "AgencyCandidate"("candidateId");
CREATE INDEX "AgencyCandidate_jobId_idx" ON "AgencyCandidate"("jobId");

CREATE UNIQUE INDEX "AgencyJobAssignment_agencyId_jobId_key" ON "AgencyJobAssignment"("agencyId", "jobId");
CREATE INDEX "AgencyJobAssignment_agencyId_idx" ON "AgencyJobAssignment"("agencyId");
CREATE INDEX "AgencyJobAssignment_jobId_idx" ON "AgencyJobAssignment"("jobId");

CREATE UNIQUE INDEX "ApprovalWorkflowStep_workflowId_order_key" ON "ApprovalWorkflowStep"("workflowId", "order");
CREATE INDEX "ApprovalWorkflowStep_workflowId_idx" ON "ApprovalWorkflowStep"("workflowId");

CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");
CREATE INDEX "SurveyQuestion_order_idx" ON "SurveyQuestion"("order");

CREATE UNIQUE INDEX "SurveyResponse_token_key" ON "SurveyResponse"("token");
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");
CREATE INDEX "SurveyResponse_candidateId_idx" ON "SurveyResponse"("candidateId");
CREATE INDEX "SurveyResponse_token_idx" ON "SurveyResponse"("token");

CREATE UNIQUE INDEX "SurveyAnswer_responseId_questionId_key" ON "SurveyAnswer"("responseId", "questionId");
CREATE INDEX "SurveyAnswer_responseId_idx" ON "SurveyAnswer"("responseId");
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");

-- AddForeignKey
ALTER TABLE "AgencyRecruiter" ADD CONSTRAINT "AgencyRecruiter_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyCandidate" ADD CONSTRAINT "AgencyCandidate_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyCandidate" ADD CONSTRAINT "AgencyCandidate_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "AgencyRecruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyJobAssignment" ADD CONSTRAINT "AgencyJobAssignment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflowStep" ADD CONSTRAINT "ApprovalWorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "CandidateSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "CandidateSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
