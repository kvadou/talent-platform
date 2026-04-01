-- CreateEnum
CREATE TYPE "AvailabilityLinkStatus" AS ENUM ('PENDING', 'SUBMITTED', 'SCHEDULED', 'EXPIRED', 'CANCELLED');

-- CreateTable ApplicationToken
CREATE TABLE "ApplicationToken" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable AvailabilityLink
CREATE TABLE "AvailabilityLink" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "interviewerIds" TEXT[],
    "duration" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT DEFAULT 'America/Chicago',
    "status" "AvailabilityLinkStatus" NOT NULL DEFAULT 'PENDING',
    "instructions" TEXT,
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable CandidateAvailability
CREATE TABLE "CandidateAvailability" (
    "id" TEXT NOT NULL,
    "availabilityLinkId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ApplicationToken
CREATE UNIQUE INDEX "ApplicationToken_applicationId_key" ON "ApplicationToken"("applicationId");
CREATE UNIQUE INDEX "ApplicationToken_token_key" ON "ApplicationToken"("token");
CREATE INDEX "ApplicationToken_token_idx" ON "ApplicationToken"("token");

-- CreateIndex AvailabilityLink
CREATE UNIQUE INDEX "AvailabilityLink_token_key" ON "AvailabilityLink"("token");
CREATE INDEX "AvailabilityLink_applicationId_idx" ON "AvailabilityLink"("applicationId");
CREATE INDEX "AvailabilityLink_stageId_idx" ON "AvailabilityLink"("stageId");
CREATE INDEX "AvailabilityLink_token_idx" ON "AvailabilityLink"("token");
CREATE INDEX "AvailabilityLink_status_idx" ON "AvailabilityLink"("status");

-- CreateIndex CandidateAvailability
CREATE INDEX "CandidateAvailability_availabilityLinkId_idx" ON "CandidateAvailability"("availabilityLinkId");
CREATE INDEX "CandidateAvailability_startTime_idx" ON "CandidateAvailability"("startTime");

-- AddForeignKey ApplicationToken
ALTER TABLE "ApplicationToken" ADD CONSTRAINT "ApplicationToken_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey AvailabilityLink
ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CandidateAvailability
ALTER TABLE "CandidateAvailability" ADD CONSTRAINT "CandidateAvailability_availabilityLinkId_fkey" FOREIGN KEY ("availabilityLinkId") REFERENCES "AvailabilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
