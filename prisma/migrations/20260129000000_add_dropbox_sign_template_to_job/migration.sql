-- Add Dropbox Sign template ID to Job for default offer signing template
ALTER TABLE "Job" ADD COLUMN "dropboxSignTemplateId" TEXT;
