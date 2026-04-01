-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "emailDomain" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailDomainVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "emailFromAddress" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailReplyToAddress" TEXT;
