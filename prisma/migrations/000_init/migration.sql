-- Initial schema migration generated manually. Run `prisma migrate dev` to regenerate if schema changes.

CREATE TYPE "UserRole" AS ENUM ('HQ_ADMIN','MARKET_ADMIN','RECRUITER','HIRING_MANAGER');
CREATE TYPE "JobStatus" AS ENUM ('DRAFT','PUBLISHED','CLOSED','ARCHIVED');
CREATE TYPE "ApplicationStatus" AS ENUM ('ACTIVE','HIRED','REJECTED','WITHDRAWN');
CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREEN','VIDEO_INTERVIEW','TECHNICAL_INTERVIEW','BEHAVIORAL_INTERVIEW','FINAL_INTERVIEW','ONSITE');
CREATE TYPE "MessageType" AS ENUM ('EMAIL','SMS');
CREATE TYPE "MessageStatus" AS ENUM ('SENT','FAILED','BOUNCED');

CREATE TABLE "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Market" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id"),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "passwordHash" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'RECRUITER',
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id"),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserMarket" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "marketId" TEXT NOT NULL REFERENCES "Market"("id"),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId","marketId")
);
CREATE INDEX "UserMarket_market_idx" ON "UserMarket"("marketId");

CREATE TABLE "Job" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "marketId" TEXT NOT NULL REFERENCES "Market"("id"),
  "greenhouseJobId" TEXT UNIQUE,
  "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Job_market_idx" ON "Job"("marketId");
CREATE INDEX "Job_status_idx" ON "Job"("status");

CREATE TABLE "Stage" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "isDefault" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("jobId","order")
);
CREATE INDEX "Stage_job_idx" ON "Stage"("jobId");

CREATE TABLE "Candidate" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "resumeUrl" TEXT,
  "coverLetter" TEXT,
  "linkedinUrl" TEXT,
  "portfolioUrl" TEXT,
  "street" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT DEFAULT 'United States',
  "postcode" TEXT,
  "timezone" TEXT,
  "notes" TEXT,
  "tags" TEXT[],
  "greenhouseCandidateId" TEXT UNIQUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "importedToContractors" BOOLEAN DEFAULT FALSE,
  "contractorId" INTEGER UNIQUE,
  "importedAt" TIMESTAMP,
  "importNotes" TEXT
);
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

CREATE TABLE "Application" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id"),
  "candidateId" TEXT NOT NULL REFERENCES "Candidate"("id"),
  "stageId" TEXT NOT NULL REFERENCES "Stage"("id"),
  "status" "ApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
  "greenhouseApplicationId" TEXT UNIQUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Application_job_idx" ON "Application"("jobId");
CREATE INDEX "Application_candidate_idx" ON "Application"("candidateId");
CREATE INDEX "Application_stage_idx" ON "Application"("stageId");
CREATE INDEX "Application_status_idx" ON "Application"("status");

CREATE TABLE "StageHistory" (
  "id" TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"("id") ON DELETE CASCADE,
  "stageId" TEXT NOT NULL REFERENCES "Stage"("id"),
  "movedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "movedBy" TEXT
);
CREATE INDEX "StageHistory_app_idx" ON "StageHistory"("applicationId");
CREATE INDEX "StageHistory_movedAt_idx" ON "StageHistory"("movedAt");

CREATE TABLE "Interview" (
  "id" TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"("id") ON DELETE CASCADE,
  "interviewerId" TEXT NOT NULL REFERENCES "User"("id"),
  "scheduledAt" TIMESTAMP NOT NULL,
  "duration" INTEGER NOT NULL,
  "type" "InterviewType" NOT NULL,
  "location" TEXT,
  "meetingLink" TEXT,
  "notes" TEXT,
  "rating" INTEGER,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Interview_app_idx" ON "Interview"("applicationId");
CREATE INDEX "Interview_scheduled_idx" ON "Interview"("scheduledAt");

CREATE TABLE "Note" (
  "id" TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id"),
  "content" TEXT NOT NULL,
  "isPrivate" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Note_app_idx" ON "Note"("applicationId");
CREATE INDEX "Note_created_idx" ON "Note"("createdAt");

CREATE TABLE "MessageLog" (
  "id" TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "Application"("id") ON DELETE CASCADE,
  "type" "MessageType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT,
  "sentAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "errorMessage" TEXT
);
CREATE INDEX "MessageLog_app_idx" ON "MessageLog"("applicationId");
CREATE INDEX "MessageLog_sent_idx" ON "MessageLog"("sentAt");

CREATE TABLE "IntegrationToken" (
  "id" TEXT PRIMARY KEY,
  "service" TEXT NOT NULL,
  "tokenType" TEXT NOT NULL,
  "tokenValue" TEXT NOT NULL,
  "expiresAt" TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("service")
);
