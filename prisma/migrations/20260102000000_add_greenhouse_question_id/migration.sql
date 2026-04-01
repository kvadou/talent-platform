-- AlterTable
ALTER TABLE "JobQuestion" ADD COLUMN "greenhouseQuestionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JobQuestion_greenhouseQuestionId_key" ON "JobQuestion"("greenhouseQuestionId");

-- CreateIndex
CREATE INDEX "JobQuestion_greenhouseQuestionId_idx" ON "JobQuestion"("greenhouseQuestionId");
