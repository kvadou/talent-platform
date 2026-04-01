import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateCandidateEmbedding, updateJobEmbedding } from '@/lib/matching';

// POST /api/ai/embeddings - Batch update embeddings
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, ids, all, limit = 100 } = body;

    if (!type || !['candidate', 'job'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "candidate" or "job"' },
        { status: 400 }
      );
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (type === 'candidate') {
      let candidateIds: string[];

      if (all) {
        // Get candidates that need embeddings (missing or outdated)
        const candidates = await prisma.candidate.findMany({
          where: {
            resumeText: { not: null },
            OR: [
              { embeddingUpdatedAt: null },
              {
                embeddingUpdatedAt: {
                  lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
                },
              },
            ],
          },
          select: { id: true },
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        candidateIds = candidates.map((c) => c.id);
      } else if (ids && Array.isArray(ids)) {
        candidateIds = ids.slice(0, limit);
      } else {
        return NextResponse.json(
          { error: 'Either ids array or all=true is required' },
          { status: 400 }
        );
      }

      for (const id of candidateIds) {
        results.processed++;
        try {
          const success = await updateCandidateEmbedding(id);
          if (success) {
            results.succeeded++;
          } else {
            results.failed++;
            results.errors.push(`Candidate ${id}: insufficient data`);
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`Candidate ${id}: ${(err as Error).message}`);
        }
      }
    } else if (type === 'job') {
      let jobIds: string[];

      if (all) {
        // Get jobs that need embeddings
        const jobs = await prisma.job.findMany({
          where: {
            description: { not: null },
            OR: [
              { embeddingUpdatedAt: null },
              {
                embeddingUpdatedAt: {
                  lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
          select: { id: true },
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        jobIds = jobs.map((j) => j.id);
      } else if (ids && Array.isArray(ids)) {
        jobIds = ids.slice(0, limit);
      } else {
        return NextResponse.json(
          { error: 'Either ids array or all=true is required' },
          { status: 400 }
        );
      }

      for (const id of jobIds) {
        results.processed++;
        try {
          const success = await updateJobEmbedding(id);
          if (success) {
            results.succeeded++;
          } else {
            results.failed++;
            results.errors.push(`Job ${id}: insufficient data`);
          }
        } catch (err) {
          results.failed++;
          results.errors.push(`Job ${id}: ${(err as Error).message}`);
        }
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('Error batch updating embeddings:', err);
    return NextResponse.json(
      { error: 'Failed to update embeddings' },
      { status: 500 }
    );
  }
}

// GET /api/ai/embeddings - Get embedding stats
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Count candidates with/without embeddings
    const [candidatesTotal, candidatesWithEmbedding, jobsTotal, jobsWithEmbedding] =
      await Promise.all([
        prisma.candidate.count(),
        prisma.candidate.count({ where: { embeddingUpdatedAt: { not: null } } }),
        prisma.job.count(),
        prisma.job.count({ where: { embeddingUpdatedAt: { not: null } } }),
      ]);

    return NextResponse.json({
      candidates: {
        total: candidatesTotal,
        withEmbedding: candidatesWithEmbedding,
        withoutEmbedding: candidatesTotal - candidatesWithEmbedding,
        coverage: candidatesTotal > 0
          ? Math.round((candidatesWithEmbedding / candidatesTotal) * 100)
          : 0,
      },
      jobs: {
        total: jobsTotal,
        withEmbedding: jobsWithEmbedding,
        withoutEmbedding: jobsTotal - jobsWithEmbedding,
        coverage: jobsTotal > 0
          ? Math.round((jobsWithEmbedding / jobsTotal) * 100)
          : 0,
      },
    });
  } catch (err) {
    console.error('Error getting embedding stats:', err);
    return NextResponse.json(
      { error: 'Failed to get embedding stats' },
      { status: 500 }
    );
  }
}
