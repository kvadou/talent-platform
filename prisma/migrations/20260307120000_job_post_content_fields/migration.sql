-- AlterTable: Add content, location, views fields and boardType index to JobPost
ALTER TABLE "JobPost" ADD COLUMN "content" TEXT;
ALTER TABLE "JobPost" ADD COLUMN "location" VARCHAR(255);
ALTER TABLE "JobPost" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "JobPost_boardType_idx" ON "JobPost"("boardType");
