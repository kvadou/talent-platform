-- CreateEnum
CREATE TYPE "PatternType" AS ENUM ('ANSWER_QUALITY', 'COMMUNICATION_STYLE', 'ENTHUSIASM_SIGNAL', 'RED_FLAG', 'EXPERIENCE_CLAIM', 'QUESTION_ASKED');

-- CreateTable
CREATE TABLE "InterviewPattern" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "patternType" "PatternType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "context" TEXT,
    "positiveSignal" BOOLEAN NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "confidence" DOUBLE PRECISION NOT NULL,
    "exampleCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceInterviewIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswerExample" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionIntent" TEXT,
    "exampleAnswer" TEXT NOT NULL,
    "isGoodExample" BOOLEAN NOT NULL,
    "explanation" TEXT,
    "qualityScore" INTEGER,
    "sourceTranscriptId" TEXT,
    "sourceInterviewId" TEXT,
    "jobId" TEXT,
    "attributeId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAnswerExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewPattern_jobId_idx" ON "InterviewPattern"("jobId");

-- CreateIndex
CREATE INDEX "InterviewPattern_patternType_idx" ON "InterviewPattern"("patternType");

-- CreateIndex
CREATE INDEX "InterviewPattern_positiveSignal_idx" ON "InterviewPattern"("positiveSignal");

-- CreateIndex
CREATE INDEX "InterviewPattern_isVerified_idx" ON "InterviewPattern"("isVerified");

-- CreateIndex
CREATE INDEX "InterviewPattern_confidence_idx" ON "InterviewPattern"("confidence");

-- CreateIndex
CREATE INDEX "QuestionAnswerExample_jobId_idx" ON "QuestionAnswerExample"("jobId");

-- CreateIndex
CREATE INDEX "QuestionAnswerExample_isGoodExample_idx" ON "QuestionAnswerExample"("isGoodExample");

-- CreateIndex
CREATE INDEX "QuestionAnswerExample_isVerified_idx" ON "QuestionAnswerExample"("isVerified");

-- AddForeignKey
ALTER TABLE "InterviewPattern" ADD CONSTRAINT "InterviewPattern_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPattern" ADD CONSTRAINT "InterviewPattern_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerExample" ADD CONSTRAINT "QuestionAnswerExample_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerExample" ADD CONSTRAINT "QuestionAnswerExample_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
