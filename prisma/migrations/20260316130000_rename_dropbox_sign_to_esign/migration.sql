-- AlterTable: Rename dropboxSignTemplateId to esignTemplateId on Job
ALTER TABLE "Job" RENAME COLUMN "dropboxSignTemplateId" TO "esignTemplateId";
