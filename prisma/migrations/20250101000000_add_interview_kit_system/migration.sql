-- Add new enum values to InterviewType
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'VIDEO_INTERVIEW_AUDITION';
ALTER TYPE "InterviewType" ADD VALUE IF NOT EXISTS 'IN_PERSON';

-- Create RecordingStatus enum
DO $$ BEGIN
    CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create OverallRecommendation enum
DO $$ BEGIN
    CREATE TYPE "OverallRecommendation" AS ENUM ('STRONG_NO', 'NO', 'YES', 'STRONG_YES');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create InterviewKit table
CREATE TABLE IF NOT EXISTS "InterviewKit" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stageId" TEXT,
    "name" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "includesAudition" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewKit_pkey" PRIMARY KEY ("id")
);

-- Create InterviewKitPrepItem table
CREATE TABLE IF NOT EXISTS "InterviewKitPrepItem" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewKitPrepItem_pkey" PRIMARY KEY ("id")
);

-- Create InterviewKitCategory table
CREATE TABLE IF NOT EXISTS "InterviewKitCategory" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewKitCategory_pkey" PRIMARY KEY ("id")
);

-- Create InterviewKitAttribute table
CREATE TABLE IF NOT EXISTS "InterviewKitAttribute" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewKitAttribute_pkey" PRIMARY KEY ("id")
);

-- Create InterviewRecording table
CREATE TABLE IF NOT EXISTS "InterviewRecording" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "zoomMeetingId" TEXT,
    "zoomRecordingId" TEXT,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING',
    "recordedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRecording_pkey" PRIMARY KEY ("id")
);

-- Create InterviewTranscript table
CREATE TABLE IF NOT EXISTS "InterviewTranscript" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "segments" JSONB NOT NULL,
    "whisperJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTranscript_pkey" PRIMARY KEY ("id")
);

-- Create InterviewAISummary table
CREATE TABLE IF NOT EXISTS "InterviewAISummary" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "attributeAnalysis" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "recommendationScore" INTEGER NOT NULL,
    "recommendationReason" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "concerns" JSONB NOT NULL,
    "followUpQuestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewAISummary_pkey" PRIMARY KEY ("id")
);

-- Create InterviewKitScorecard table
CREATE TABLE IF NOT EXISTS "InterviewKitScorecard" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "scorerId" TEXT NOT NULL,
    "keyTakeaways" TEXT,
    "privateNotes" TEXT,
    "overallRecommendation" "OverallRecommendation" NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewKitScorecard_pkey" PRIMARY KEY ("id")
);

-- Create InterviewKitRating table
CREATE TABLE IF NOT EXISTS "InterviewKitRating" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "notes" TEXT,
    "aiSuggested" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewKitRating_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
ALTER TABLE "InterviewRecording" ADD CONSTRAINT "InterviewRecording_interviewId_key" UNIQUE ("interviewId");
ALTER TABLE "InterviewTranscript" ADD CONSTRAINT "InterviewTranscript_recordingId_key" UNIQUE ("recordingId");
ALTER TABLE "InterviewAISummary" ADD CONSTRAINT "InterviewAISummary_interviewId_key" UNIQUE ("interviewId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "InterviewKit_jobId_idx" ON "InterviewKit"("jobId");
CREATE INDEX IF NOT EXISTS "InterviewKit_stageId_idx" ON "InterviewKit"("stageId");
CREATE INDEX IF NOT EXISTS "InterviewKitPrepItem_kitId_idx" ON "InterviewKitPrepItem"("kitId");
CREATE INDEX IF NOT EXISTS "InterviewKitCategory_kitId_idx" ON "InterviewKitCategory"("kitId");
CREATE INDEX IF NOT EXISTS "InterviewKitAttribute_categoryId_idx" ON "InterviewKitAttribute"("categoryId");
CREATE INDEX IF NOT EXISTS "InterviewKitScorecard_interviewId_idx" ON "InterviewKitScorecard"("interviewId");
CREATE INDEX IF NOT EXISTS "InterviewKitScorecard_scorerId_idx" ON "InterviewKitScorecard"("scorerId");
CREATE INDEX IF NOT EXISTS "InterviewKitRating_scorecardId_idx" ON "InterviewKitRating"("scorecardId");
CREATE INDEX IF NOT EXISTS "InterviewKitRating_attributeId_idx" ON "InterviewKitRating"("attributeId");

-- Add foreign keys
ALTER TABLE "InterviewKit" ADD CONSTRAINT "InterviewKit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewKit" ADD CONSTRAINT "InterviewKit_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InterviewKitPrepItem" ADD CONSTRAINT "InterviewKitPrepItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "InterviewKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewKitCategory" ADD CONSTRAINT "InterviewKitCategory_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "InterviewKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewKitAttribute" ADD CONSTRAINT "InterviewKitAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InterviewKitCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewRecording" ADD CONSTRAINT "InterviewRecording_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewTranscript" ADD CONSTRAINT "InterviewTranscript_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "InterviewRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewAISummary" ADD CONSTRAINT "InterviewAISummary_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewKitScorecard" ADD CONSTRAINT "InterviewKitScorecard_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewKitScorecard" ADD CONSTRAINT "InterviewKitScorecard_scorerId_fkey" FOREIGN KEY ("scorerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InterviewKitRating" ADD CONSTRAINT "InterviewKitRating_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "InterviewKitScorecard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewKitRating" ADD CONSTRAINT "InterviewKitRating_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "InterviewKitAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
