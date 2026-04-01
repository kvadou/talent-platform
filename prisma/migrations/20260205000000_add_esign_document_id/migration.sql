-- Add esignDocumentId field to Offer table for E-Sign integration
ALTER TABLE "Offer" ADD COLUMN "esignDocumentId" TEXT;
