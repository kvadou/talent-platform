-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "careerSiteUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "careerSiteLogo" TEXT;
ALTER TABLE "Organization" ADD COLUMN "careerSitePrimaryColor" TEXT DEFAULT '#7C3AED';
ALTER TABLE "Organization" ADD COLUMN "careerSiteHeadline" TEXT DEFAULT 'Join Our Team';
ALTER TABLE "Organization" ADD COLUMN "careerSiteDescription" TEXT DEFAULT 'We''re looking for talented people to join our team.';
