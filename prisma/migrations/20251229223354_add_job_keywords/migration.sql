-- CreateTable
CREATE TABLE "JobKeyword" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "expansions" TEXT[],
    "weight" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobKeyword_jobId_idx" ON "JobKeyword"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobKeyword_jobId_keyword_key" ON "JobKeyword"("jobId", "keyword");

-- AddForeignKey
ALTER TABLE "JobKeyword" ADD CONSTRAINT "JobKeyword_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
