-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'SMS');

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newApplicationEmail" BOOLEAN NOT NULL DEFAULT true,
    "newApplicationPush" BOOLEAN NOT NULL DEFAULT true,
    "newApplicationSms" BOOLEAN NOT NULL DEFAULT false,
    "applicationUpdateEmail" BOOLEAN NOT NULL DEFAULT true,
    "applicationUpdatePush" BOOLEAN NOT NULL DEFAULT false,
    "applicationUpdateSms" BOOLEAN NOT NULL DEFAULT false,
    "interviewScheduledEmail" BOOLEAN NOT NULL DEFAULT true,
    "interviewScheduledPush" BOOLEAN NOT NULL DEFAULT true,
    "interviewScheduledSms" BOOLEAN NOT NULL DEFAULT false,
    "interviewReminderEmail" BOOLEAN NOT NULL DEFAULT true,
    "interviewReminderPush" BOOLEAN NOT NULL DEFAULT true,
    "interviewReminderSms" BOOLEAN NOT NULL DEFAULT true,
    "interviewFeedbackEmail" BOOLEAN NOT NULL DEFAULT true,
    "interviewFeedbackPush" BOOLEAN NOT NULL DEFAULT false,
    "interviewFeedbackSms" BOOLEAN NOT NULL DEFAULT false,
    "taskAssignedEmail" BOOLEAN NOT NULL DEFAULT true,
    "taskAssignedPush" BOOLEAN NOT NULL DEFAULT true,
    "taskAssignedSms" BOOLEAN NOT NULL DEFAULT false,
    "taskDueEmail" BOOLEAN NOT NULL DEFAULT true,
    "taskDuePush" BOOLEAN NOT NULL DEFAULT true,
    "taskDueSms" BOOLEAN NOT NULL DEFAULT false,
    "offerCreatedEmail" BOOLEAN NOT NULL DEFAULT true,
    "offerCreatedPush" BOOLEAN NOT NULL DEFAULT false,
    "offerCreatedSms" BOOLEAN NOT NULL DEFAULT false,
    "offerAcceptedEmail" BOOLEAN NOT NULL DEFAULT true,
    "offerAcceptedPush" BOOLEAN NOT NULL DEFAULT true,
    "offerAcceptedSms" BOOLEAN NOT NULL DEFAULT true,
    "offerDeclinedEmail" BOOLEAN NOT NULL DEFAULT true,
    "offerDeclinedPush" BOOLEAN NOT NULL DEFAULT true,
    "offerDeclinedSms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewerGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewerGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotificationPreference_userId_idx" ON "UserNotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_userId_key" ON "UserNotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "InterviewerGroupMember_groupId_idx" ON "InterviewerGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "InterviewerGroupMember_userId_idx" ON "InterviewerGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewerGroupMember_groupId_userId_key" ON "InterviewerGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewerGroupMember" ADD CONSTRAINT "InterviewerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterviewerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewerGroupMember" ADD CONSTRAINT "InterviewerGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
