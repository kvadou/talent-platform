-- AlterTable
ALTER TABLE "ScheduledMeeting" ADD COLUMN "inviteeTimezone" TEXT;
ALTER TABLE "ScheduledMeeting" ADD COLUMN "manageTokenHash" TEXT;
ALTER TABLE "ScheduledMeeting" ADD COLUMN "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "ScheduledMeeting" ADD COLUMN "rescheduledFrom" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledMeeting_manageTokenHash_key" ON "ScheduledMeeting"("manageTokenHash");
