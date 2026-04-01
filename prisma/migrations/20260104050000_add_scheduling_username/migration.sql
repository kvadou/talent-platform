-- Add scheduling username and timezone to User table
ALTER TABLE "User" ADD COLUMN "schedulingUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT DEFAULT 'America/Chicago';

-- Create unique index for scheduling username
CREATE UNIQUE INDEX "User_schedulingUsername_key" ON "User"("schedulingUsername");
