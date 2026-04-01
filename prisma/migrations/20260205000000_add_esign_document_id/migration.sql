-- Add esignDocumentId field to Offer table for STC E-Sign integration
ALTER TABLE "Offer" ADD COLUMN "esignDocumentId" TEXT;
