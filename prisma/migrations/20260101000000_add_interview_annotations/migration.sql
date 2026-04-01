-- CreateTable
CREATE TABLE "InterviewComment" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "content" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewBookmark" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewClip" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "shareToken" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewComment_recordingId_idx" ON "InterviewComment"("recordingId");

-- CreateIndex
CREATE INDEX "InterviewComment_authorId_idx" ON "InterviewComment"("authorId");

-- CreateIndex
CREATE INDEX "InterviewComment_timestamp_idx" ON "InterviewComment"("timestamp");

-- CreateIndex
CREATE INDEX "InterviewBookmark_recordingId_idx" ON "InterviewBookmark"("recordingId");

-- CreateIndex
CREATE INDEX "InterviewBookmark_authorId_idx" ON "InterviewBookmark"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewClip_shareToken_key" ON "InterviewClip"("shareToken");

-- CreateIndex
CREATE INDEX "InterviewClip_recordingId_idx" ON "InterviewClip"("recordingId");

-- CreateIndex
CREATE INDEX "InterviewClip_createdById_idx" ON "InterviewClip"("createdById");

-- CreateIndex
CREATE INDEX "InterviewClip_shareToken_idx" ON "InterviewClip"("shareToken");

-- AddForeignKey
ALTER TABLE "InterviewComment" ADD CONSTRAINT "InterviewComment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "InterviewRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewComment" ADD CONSTRAINT "InterviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewComment" ADD CONSTRAINT "InterviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InterviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBookmark" ADD CONSTRAINT "InterviewBookmark_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "InterviewRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBookmark" ADD CONSTRAINT "InterviewBookmark_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewClip" ADD CONSTRAINT "InterviewClip_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "InterviewRecording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewClip" ADD CONSTRAINT "InterviewClip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
