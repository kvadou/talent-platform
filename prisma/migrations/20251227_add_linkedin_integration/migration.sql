-- Add LinkedIn integration fields

-- Job: linkedinJobId for linking to LinkedIn job postings
ALTER TABLE "Job" ADD COLUMN "linkedinJobId" TEXT;
CREATE UNIQUE INDEX "Job_linkedinJobId_key" ON "Job"("linkedinJobId");
CREATE INDEX "Job_linkedinJobId_idx" ON "Job"("linkedinJobId");

-- Application: source and linkedinApplicationId for tracking LinkedIn applications
ALTER TABLE "Application" ADD COLUMN "source" TEXT;
ALTER TABLE "Application" ADD COLUMN "linkedinApplicationId" TEXT;
CREATE UNIQUE INDEX "Application_linkedinApplicationId_key" ON "Application"("linkedinApplicationId");
CREATE INDEX "Application_source_idx" ON "Application"("source");
