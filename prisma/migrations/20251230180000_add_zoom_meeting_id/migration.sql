-- Add zoomMeetingId field to Interview table for tracking Zoom meetings
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "zoomMeetingId" TEXT;
