-- CreateEnum
CREATE TYPE "MeetingLocationType" AS ENUM ('PHONE', 'GOOGLE_MEET', 'ZOOM', 'IN_PERSON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "MeetingLimitPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "MeetingType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "color" TEXT DEFAULT '#3b82f6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationType" "MeetingLocationType" NOT NULL DEFAULT 'PHONE',
    "locationDetails" TEXT,
    "googleMeetEnabled" BOOLEAN NOT NULL DEFAULT false,
    "zoomEnabled" BOOLEAN NOT NULL DEFAULT false,
    "zoomLink" TEXT,
    "bufferBefore" INTEGER NOT NULL DEFAULT 5,
    "bufferAfter" INTEGER NOT NULL DEFAULT 5,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxDaysOut" INTEGER NOT NULL DEFAULT 30,
    "slotIncrement" INTEGER NOT NULL DEFAULT 30,
    "maxPerDay" INTEGER,
    "maxPerWeek" INTEGER,
    "maxPerMonth" INTEGER,
    "customQuestions" JSONB,
    "sendConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "sendReminder" BOOLEAN NOT NULL DEFAULT true,
    "reminderHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "useCalendly" BOOLEAN NOT NULL DEFAULT false,
    "calendlyLink" TEXT,
    "defaultBufferBefore" INTEGER NOT NULL DEFAULT 5,
    "defaultBufferAfter" INTEGER NOT NULL DEFAULT 5,
    "showTimezoneToInvitee" BOOLEAN NOT NULL DEFAULT true,
    "autoDetectTimezone" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingType_userId_idx" ON "MeetingType"("userId");

-- CreateIndex
CREATE INDEX "MeetingType_organizationId_idx" ON "MeetingType"("organizationId");

-- CreateIndex
CREATE INDEX "MeetingType_isActive_idx" ON "MeetingType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingType_userId_slug_key" ON "MeetingType"("userId", "slug");

-- CreateIndex
CREATE INDEX "RecruiterAvailability_userId_idx" ON "RecruiterAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruiterAvailability_userId_dayOfWeek_key" ON "RecruiterAvailability"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleException_userId_idx" ON "ScheduleException"("userId");

-- CreateIndex
CREATE INDEX "ScheduleException_date_idx" ON "ScheduleException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_userId_date_key" ON "ScheduleException"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingPreferences_userId_key" ON "SchedulingPreferences"("userId");

-- CreateIndex
CREATE INDEX "SchedulingPreferences_userId_idx" ON "SchedulingPreferences"("userId");

-- AlterTable SchedulingLink
ALTER TABLE "SchedulingLink" ADD COLUMN IF NOT EXISTS "meetingTypeId" TEXT;
ALTER TABLE "SchedulingLink" ADD COLUMN IF NOT EXISTS "locationType" "MeetingLocationType";
ALTER TABLE "SchedulingLink" ADD COLUMN IF NOT EXISTS "locationDetails" TEXT;
ALTER TABLE "SchedulingLink" ADD COLUMN IF NOT EXISTS "googleMeetLink" TEXT;
ALTER TABLE "SchedulingLink" ADD COLUMN IF NOT EXISTS "zoomLink" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchedulingLink_meetingTypeId_idx" ON "SchedulingLink"("meetingTypeId");

-- AddForeignKey
ALTER TABLE "MeetingType" ADD CONSTRAINT "MeetingType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingType" ADD CONSTRAINT "MeetingType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterAvailability" ADD CONSTRAINT "RecruiterAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingPreferences" ADD CONSTRAINT "SchedulingPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingLink" ADD CONSTRAINT "SchedulingLink_meetingTypeId_fkey" FOREIGN KEY ("meetingTypeId") REFERENCES "MeetingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
