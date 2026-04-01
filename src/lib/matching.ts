import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateCandidateEmbedding, generateJobEmbedding } from '@/lib/openai';
import { sendEmail } from '@/lib/postmark';
import { highMatchCandidateAlert } from '@/lib/email-templates';

const HIGH_MATCH_THRESHOLD = 80; // Send alert for 80%+ matches

/**
 * Update the embedding for a single candidate
 */
export async function updateCandidateEmbedding(candidateId: string): Promise<boolean> {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        resumeText: true,
        notes: true,
        coverLetter: true,
        tags: true,
      },
    });

    if (!candidate) {
      console.warn(`Candidate ${candidateId} not found`);
      return false;
    }

    // Generate embedding
    const embedding = await generateCandidateEmbedding(candidate);

    // Update using raw SQL since Prisma doesn't support vector types natively
    await prisma.$executeRaw`
      UPDATE "Candidate"
      SET "embedding" = ${JSON.stringify(embedding)}::vector,
          "embeddingUpdatedAt" = NOW()
      WHERE "id" = ${candidateId}
    `;

    return true;
  } catch (err) {
    console.error(`Failed to update embedding for candidate ${candidateId}:`, err);
    return false;
  }
}

/**
 * Update the embedding for a single job
 */
export async function updateJobEmbedding(jobId: string): Promise<boolean> {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        matchingKeywords: {
          select: {
            keyword: true,
            expansions: true,
          },
        },
      },
    });

    if (!job) {
      console.warn(`Job ${jobId} not found`);
      return false;
    }

    // Generate embedding
    const embedding = await generateJobEmbedding({
      title: job.title,
      description: job.description,
      location: job.location,
      keywords: job.matchingKeywords,
    });

    // Update using raw SQL since Prisma doesn't support vector types natively
    await prisma.$executeRaw`
      UPDATE "Job"
      SET "embedding" = ${JSON.stringify(embedding)}::vector,
          "embeddingUpdatedAt" = NOW()
      WHERE "id" = ${jobId}
    `;

    return true;
  } catch (err) {
    console.error(`Failed to update embedding for job ${jobId}:`, err);
    return false;
  }
}

/**
 * Compute keyword match score between a candidate and job
 * Returns a score from 0-100 based on keyword matches
 */
export async function computeKeywordScore(
  candidateId: string,
  jobId: string
): Promise<{ score: number; matchedKeywords: Record<string, number> }> {
  // Get candidate's searchable text
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      resumeText: true,
      notes: true,
      coverLetter: true,
      tags: true,
    },
  });

  if (!candidate) {
    return { score: 0, matchedKeywords: {} };
  }

  // Get job's keywords
  const jobKeywords = await prisma.jobKeyword.findMany({
    where: { jobId },
    select: {
      keyword: true,
      expansions: true,
      weight: true,
    },
  });

  if (jobKeywords.length === 0) {
    return { score: 0, matchedKeywords: {} };
  }

  // Combine candidate text
  const candidateText = [
    candidate.resumeText || '',
    candidate.notes || '',
    candidate.coverLetter || '',
    (candidate.tags || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedKeywords: Record<string, number> = {};

  for (const kw of jobKeywords) {
    totalWeight += kw.weight;

    // Check if keyword or any expansion matches
    const allTerms = [kw.keyword, ...kw.expansions];
    let matches = 0;

    for (const term of allTerms) {
      // Use word boundary matching
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
      const termMatches = (candidateText.match(regex) || []).length;
      matches += termMatches;
    }

    if (matches > 0) {
      matchedKeywords[kw.keyword] = matches;
      matchedWeight += kw.weight;
    }
  }

  // Score is weighted percentage
  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  return { score, matchedKeywords };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute embedding similarity score between candidate and job
 * Returns a score from 0-100 based on cosine similarity
 */
export async function computeEmbeddingScore(
  candidateId: string,
  jobId: string
): Promise<number> {
  // Use pgvector's cosine similarity operator
  const result = await prisma.$queryRaw<{ similarity: number }[]>`
    SELECT 1 - (c."embedding" <=> j."embedding") as similarity
    FROM "Candidate" c, "Job" j
    WHERE c."id" = ${candidateId}
      AND j."id" = ${jobId}
      AND c."embedding" IS NOT NULL
      AND j."embedding" IS NOT NULL
  `;

  if (result.length === 0 || result[0].similarity === null) {
    return 0;
  }

  // Convert cosine similarity (-1 to 1) to 0-100 score
  // Note: <=> returns distance, so 1 - distance = similarity
  const similarity = result[0].similarity;
  return Math.round(Math.max(0, similarity) * 100);
}

/**
 * Compute and cache the combined match score between a candidate and job
 */
export async function computeMatchScore(
  candidateId: string,
  jobId: string
): Promise<{
  keywordScore: number;
  embeddingScore: number;
  combinedScore: number;
  matchedKeywords: Record<string, number>;
}> {
  // Compute both scores
  const { score: keywordScore, matchedKeywords } = await computeKeywordScore(
    candidateId,
    jobId
  );
  const embeddingScore = await computeEmbeddingScore(candidateId, jobId);

  // Combined score: 60% keyword (explicit matches), 40% embedding (semantic)
  const combinedScore = Math.round(keywordScore * 0.6 + embeddingScore * 0.4);

  // Upsert into JobCandidateMatch
  await prisma.jobCandidateMatch.upsert({
    where: {
      jobId_candidateId: { jobId, candidateId },
    },
    create: {
      jobId,
      candidateId,
      keywordScore,
      embeddingScore,
      combinedScore,
      matchedKeywords,
    },
    update: {
      keywordScore,
      embeddingScore,
      combinedScore,
      matchedKeywords,
      updatedAt: new Date(),
    },
  });

  return { keywordScore, embeddingScore, combinedScore, matchedKeywords };
}

/**
 * Get candidates ranked by match score for a job
 */
export async function getRankedCandidates(
  jobId: string,
  options: {
    limit?: number;
    offset?: number;
    minScore?: number;
    candidateIds?: string[];
  } = {}
): Promise<
  {
    candidateId: string;
    keywordScore: number | null;
    embeddingScore: number | null;
    combinedScore: number;
    matchedKeywords: Record<string, number> | null;
  }[]
> {
  const { limit = 50, offset = 0, minScore = 0, candidateIds } = options;

  const whereClause: Record<string, unknown> = {
    jobId,
    combinedScore: { gte: minScore },
  };

  if (candidateIds && candidateIds.length > 0) {
    whereClause.candidateId = { in: candidateIds };
  }

  const matches = await prisma.jobCandidateMatch.findMany({
    where: whereClause,
    orderBy: { combinedScore: 'desc' },
    take: limit,
    skip: offset,
    select: {
      candidateId: true,
      keywordScore: true,
      embeddingScore: true,
      combinedScore: true,
      matchedKeywords: true,
    },
  });

  return matches.map((m) => ({
    ...m,
    matchedKeywords: m.matchedKeywords as Record<string, number> | null,
  }));
}

/**
 * Find semantically similar candidates to a job using vector search
 */
export async function findSimilarCandidates(
  jobId: string,
  limit: number = 50
): Promise<{ candidateId: string; similarity: number }[]> {
  const result = await prisma.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT c."id", 1 - (c."embedding" <=> j."embedding") as similarity
    FROM "Candidate" c, "Job" j
    WHERE j."id" = ${jobId}
      AND c."embedding" IS NOT NULL
      AND j."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> j."embedding"
    LIMIT ${limit}
  `;

  return result.map((r) => ({
    candidateId: r.id,
    similarity: Math.round(r.similarity * 100),
  }));
}

/**
 * Batch update match scores for candidates who applied to a job
 * Uses bulk SQL operations for speed with large candidate counts
 */
export async function updateMatchScoresForJob(jobId: string): Promise<number> {
  // Pre-fetch job keywords once
  const jobKeywords = await prisma.jobKeyword.findMany({
    where: { jobId },
    select: { keyword: true, expansions: true, weight: true },
  });

  if (jobKeywords.length === 0) {
    console.log(`No keywords configured for job ${jobId}`);
    return 0;
  }

  // Get candidates who applied to THIS job with their text data
  const candidates = await prisma.$queryRaw<{
    id: string;
    resumeText: string | null;
    notes: string | null;
    coverLetter: string | null;
    tags: string[];
  }[]>`
    SELECT DISTINCT c."id", c."resumeText", c."notes", c."coverLetter", c."tags"
    FROM "Candidate" c
    INNER JOIN "Application" a ON a."candidateId" = c."id"
    WHERE a."jobId" = ${jobId}
  `;

  if (candidates.length === 0) {
    console.log(`No applications for job ${jobId}`);
    return 0;
  }

  console.log(`Matching ${candidates.length} candidates for job ${jobId}`);

  // Compute scores in memory (fast)
  const scores: { id: string; candidateId: string; keywordScore: number; combinedScore: number; matchedKeywords: string }[] = [];

  for (const candidate of candidates) {
    const candidateText = [
      candidate.resumeText || '',
      candidate.notes || '',
      candidate.coverLetter || '',
      (candidate.tags || []).join(' '),
    ].join(' ').toLowerCase();

    let totalWeight = 0;
    let matchedWeight = 0;
    const matchedKeywords: Record<string, number> = {};

    for (const kw of jobKeywords) {
      totalWeight += kw.weight;
      const allTerms = [kw.keyword, ...kw.expansions];
      let matches = 0;
      for (const term of allTerms) {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
        matches += (candidateText.match(regex) || []).length;
      }
      if (matches > 0) {
        matchedKeywords[kw.keyword] = matches;
        matchedWeight += kw.weight;
      }
    }

    const keywordScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    scores.push({
      id: `match_${jobId}_${candidate.id}`,
      candidateId: candidate.id,
      keywordScore,
      combinedScore: keywordScore,
      matchedKeywords: JSON.stringify(matchedKeywords),
    });
  }

  // Bulk upsert using Prisma.sql for safe parameterization
  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < scores.length; i += BATCH_SIZE) {
    const batch = scores.slice(i, i + BATCH_SIZE);

    const values = batch.map(s =>
      Prisma.sql`(gen_random_uuid()::text, ${jobId}, ${s.candidateId}, ${s.keywordScore}, NULL, ${s.combinedScore}, ${s.matchedKeywords}::jsonb, NOW(), NOW())`
    );

    await prisma.$executeRaw`
      INSERT INTO "JobCandidateMatch" ("id", "jobId", "candidateId", "keywordScore", "embeddingScore", "combinedScore", "matchedKeywords", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("jobId", "candidateId")
      DO UPDATE SET
        "keywordScore" = EXCLUDED."keywordScore",
        "combinedScore" = EXCLUDED."combinedScore",
        "matchedKeywords" = EXCLUDED."matchedKeywords",
        "updatedAt" = NOW()
    `;

    updated += batch.length;
  }

  return updated;
}

/**
 * Check if a match score is high enough to alert and send notification
 */
export async function checkAndSendHighMatchAlert(
  candidateId: string,
  jobId: string,
  matchScore: number,
  matchedKeywords: Record<string, number>
): Promise<void> {
  if (matchScore < HIGH_MATCH_THRESHOLD) {
    return; // Not a high enough match
  }

  try {
    // Get candidate, job, and application details
    const [candidate, job, application] = await Promise.all([
      prisma.candidate.findUnique({
        where: { id: candidateId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, hiringTeam: { select: { user: { select: { email: true } } } } },
      }),
      prisma.application.findFirst({
        where: { candidateId, jobId },
        select: { id: true },
      }),
    ]);

    if (!candidate || !job || !application) {
      return;
    }

    // Get team members to notify
    const recipientEmails = job.hiringTeam
      .map((tm) => tm.user.email)
      .filter((email): email is string => !!email);

    if (recipientEmails.length === 0) {
      return; // No one to notify
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const applicationUrl = `${baseUrl}/applications/${application.id}`;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const keywordsList = Object.keys(matchedKeywords);

    const template = highMatchCandidateAlert(
      candidateName,
      candidate.email,
      job.title,
      matchScore,
      applicationUrl,
      keywordsList
    );

    // Send to each team member
    for (const email of recipientEmails) {
      try {
        await sendEmail({
          to: email,
          subject: template.subject,
          htmlBody: template.html,
        });
      } catch (err) {
        console.error(`Failed to send high-match alert to ${email}:`, err);
      }
    }

    console.log(`High-match alert sent for ${candidateName} (${matchScore}%) on ${job.title}`);
  } catch (err) {
    console.error('Failed to send high-match alert:', err);
  }
}
