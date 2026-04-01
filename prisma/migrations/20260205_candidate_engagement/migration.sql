-- CreateTable
CREATE TABLE "CandidateEngagement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "uniqueViewDays" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "puzzlesAttempted" INTEGER NOT NULL DEFAULT 0,
    "puzzlesSolved" INTEGER NOT NULL DEFAULT 0,
    "puzzleBestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEngagement_applicationId_key" ON "CandidateEngagement"("applicationId");

-- CreateIndex
CREATE INDEX "CandidateEngagement_applicationId_idx" ON "CandidateEngagement"("applicationId");

-- AddForeignKey
ALTER TABLE "CandidateEngagement" ADD CONSTRAINT "CandidateEngagement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
