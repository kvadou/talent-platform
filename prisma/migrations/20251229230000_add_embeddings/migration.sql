-- Add embedding columns for AI-powered candidate matching
-- Requires pgvector extension (CREATE EXTENSION vector;)

-- Add embedding column to Candidate
ALTER TABLE "Candidate" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "Candidate" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

-- Add embedding column to Job
ALTER TABLE "Job" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "Job" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

-- Create JobCandidateMatch table for cached match scores
CREATE TABLE "JobCandidateMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "keywordScore" DOUBLE PRECISION,
    "embeddingScore" DOUBLE PRECISION,
    "combinedScore" DOUBLE PRECISION NOT NULL,
    "matchedKeywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCandidateMatch_pkey" PRIMARY KEY ("id")
);

-- Create indexes for JobCandidateMatch
CREATE UNIQUE INDEX "JobCandidateMatch_jobId_candidateId_key" ON "JobCandidateMatch"("jobId", "candidateId");
CREATE INDEX "JobCandidateMatch_jobId_idx" ON "JobCandidateMatch"("jobId");
CREATE INDEX "JobCandidateMatch_candidateId_idx" ON "JobCandidateMatch"("candidateId");
CREATE INDEX "JobCandidateMatch_combinedScore_idx" ON "JobCandidateMatch"("combinedScore");

-- Create HNSW index for fast vector similarity search on Candidate embeddings
CREATE INDEX "Candidate_embedding_idx" ON "Candidate" USING hnsw ("embedding" vector_cosine_ops);

-- Create HNSW index for fast vector similarity search on Job embeddings
CREATE INDEX "Job_embedding_idx" ON "Job" USING hnsw ("embedding" vector_cosine_ops);
