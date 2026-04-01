-- CreateTable
CREATE TABLE "BackgroundCheck" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "checkrCandidateId" TEXT,
    "checkrReportId" TEXT,
    "package" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "adjudication" TEXT,
    "reportUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundCheck_checkrReportId_key" ON "BackgroundCheck"("checkrReportId");

-- CreateIndex
CREATE INDEX "BackgroundCheck_candidateId_idx" ON "BackgroundCheck"("candidateId");

-- CreateIndex
CREATE INDEX "BackgroundCheck_checkrReportId_idx" ON "BackgroundCheck"("checkrReportId");

-- CreateIndex
CREATE INDEX "BackgroundCheck_status_idx" ON "BackgroundCheck"("status");

-- AddForeignKey
ALTER TABLE "BackgroundCheck" ADD CONSTRAINT "BackgroundCheck_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
