// pdf-parse v1.x - simple buffer-in, text-out API
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import { downloadResumeBuffer } from './s3';
import { prisma } from './prisma';

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

/**
 * Extract text from a resume stored in S3 and update the candidate record
 */
export async function extractAndStoreResumeText(candidateId: string): Promise<string | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { resumeUrl: true },
  });

  if (!candidate?.resumeUrl) {
    console.log(`No resume URL for candidate ${candidateId}`);
    return null;
  }

  // Extract S3 key from the URL
  // URLs can be in format: https://bucket.s3.region.amazonaws.com/key
  // or just the key itself if stored that way
  let key = candidate.resumeUrl;
  if (candidate.resumeUrl.includes('amazonaws.com')) {
    const url = new URL(candidate.resumeUrl);
    key = url.pathname.slice(1); // Remove leading /
  }

  // Skip non-PDF files
  if (!key.toLowerCase().endsWith('.pdf') && !candidate.resumeUrl.toLowerCase().includes('.pdf')) {
    console.log(`Skipping non-PDF file for candidate ${candidateId}: ${key}`);
    return null;
  }

  try {
    const buffer = await downloadResumeBuffer(key);
    const text = await extractTextFromPdf(buffer);

    if (text) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { resumeText: text },
      });
      console.log(`Extracted ${text.length} chars for candidate ${candidateId}`);
    }

    return text;
  } catch (error) {
    console.error(`Error extracting resume for candidate ${candidateId}:`, error);
    return null;
  }
}

/**
 * Batch process candidates to extract resume text
 */
export async function batchExtractResumeText(options: {
  limit?: number;
  onlyMissing?: boolean;
}): Promise<{ processed: number; success: number; failed: number }> {
  const { limit = 100, onlyMissing = true } = options;

  const candidates = await prisma.candidate.findMany({
    where: {
      resumeUrl: { not: null },
      ...(onlyMissing ? { resumeText: null } : {}),
    },
    select: { id: true, resumeUrl: true },
    take: limit,
  });

  let success = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const text = await extractAndStoreResumeText(candidate.id);
      if (text) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to process candidate ${candidate.id}:`, error);
      failed++;
    }
  }

  return { processed: candidates.length, success, failed };
}

/**
 * Extract text from a URL (for Greenhouse imports where we have direct URLs)
 */
export async function extractTextFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch URL ${url}: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await extractTextFromPdf(buffer);
  } catch (error) {
    console.error(`Error extracting text from URL ${url}:`, error);
    return null;
  }
}
