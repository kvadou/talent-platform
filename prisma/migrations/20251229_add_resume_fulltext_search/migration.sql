-- Add resumeText column for storing extracted PDF text
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "resumeText" TEXT;

-- Add searchVector column for PostgreSQL full-text search
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Candidate_searchVector_idx" ON "Candidate" USING GIN ("searchVector");

-- Populate searchVector for existing candidates
UPDATE "Candidate"
SET "searchVector" = (
  setweight(to_tsvector('english', coalesce("firstName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("lastName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', coalesce("resumeText", '')), 'C') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(state, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(country, '')), 'D')
);
