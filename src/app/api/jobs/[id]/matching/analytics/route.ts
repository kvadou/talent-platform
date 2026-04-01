import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/jobs/[id]/matching/analytics - Get matching analytics for a job
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  try {
    // Get all match scores for this job
    const matches = await prisma.jobCandidateMatch.findMany({
      where: { jobId },
      select: {
        combinedScore: true,
        keywordScore: true,
        embeddingScore: true,
        matchedKeywords: true,
      },
    });

    // Calculate score distribution
    const scoreRanges = {
      excellent: 0, // 80-100
      good: 0,      // 60-79
      fair: 0,      // 40-59
      low: 0,       // 20-39
      poor: 0,      // 0-19
    };

    for (const match of matches) {
      if (match.combinedScore >= 80) scoreRanges.excellent++;
      else if (match.combinedScore >= 60) scoreRanges.good++;
      else if (match.combinedScore >= 40) scoreRanges.fair++;
      else if (match.combinedScore >= 20) scoreRanges.low++;
      else scoreRanges.poor++;
    }

    // Calculate keyword effectiveness
    const keywordStats: Record<string, { matches: number; totalHits: number }> = {};

    for (const match of matches) {
      const kws = match.matchedKeywords as Record<string, number> | null;
      if (kws) {
        for (const [keyword, hits] of Object.entries(kws)) {
          if (!keywordStats[keyword]) {
            keywordStats[keyword] = { matches: 0, totalHits: 0 };
          }
          keywordStats[keyword].matches++;
          keywordStats[keyword].totalHits += hits;
        }
      }
    }

    // Get job keywords for comparison
    const jobKeywords = await prisma.jobKeyword.findMany({
      where: { jobId },
      select: { keyword: true, weight: true },
    });

    const keywordEffectiveness = jobKeywords.map((kw) => {
      const stats = keywordStats[kw.keyword] || { matches: 0, totalHits: 0 };
      const matchRate = matches.length > 0
        ? Math.round((stats.matches / matches.length) * 100)
        : 0;
      return {
        keyword: kw.keyword,
        weight: kw.weight,
        candidatesMatched: stats.matches,
        totalHits: stats.totalHits,
        matchRate,
      };
    });

    // Sort by match rate (descending)
    keywordEffectiveness.sort((a, b) => b.matchRate - a.matchRate);

    // Calculate averages
    const avgScores = matches.length > 0
      ? {
          combined: Math.round(
            matches.reduce((sum, m) => sum + m.combinedScore, 0) / matches.length
          ),
          keyword: Math.round(
            matches.reduce((sum, m) => sum + (m.keywordScore || 0), 0) / matches.length
          ),
          embedding: Math.round(
            matches.reduce((sum, m) => sum + (m.embeddingScore || 0), 0) / matches.length
          ),
        }
      : { combined: 0, keyword: 0, embedding: 0 };

    // Get embedding coverage
    const [candidatesTotal, candidatesWithEmbedding, jobHasEmbedding] = await Promise.all([
      prisma.application.count({ where: { jobId } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "Candidate" c
        JOIN "Application" a ON a."candidateId" = c."id"
        WHERE a."jobId" = ${jobId}
          AND c."embeddingUpdatedAt" IS NOT NULL
      `.then((r) => Number(r[0]?.count || 0)),
      prisma.job.findUnique({
        where: { id: jobId },
        select: { embeddingUpdatedAt: true },
      }).then((j) => !!j?.embeddingUpdatedAt),
    ]);

    return NextResponse.json({
      totalCandidates: matches.length,
      scoreDistribution: scoreRanges,
      averageScores: avgScores,
      keywordEffectiveness,
      embeddingCoverage: {
        candidatesTotal,
        candidatesWithEmbedding,
        jobHasEmbedding,
        coveragePercent: candidatesTotal > 0
          ? Math.round((candidatesWithEmbedding / candidatesTotal) * 100)
          : 0,
      },
    });
  } catch (err) {
    console.error('Error getting matching analytics:', err);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}
