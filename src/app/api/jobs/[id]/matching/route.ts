import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeMatchScore,
  getRankedCandidates,
  updateMatchScoresForJob,
  findSimilarCandidates,
} from '@/lib/matching';

// GET /api/jobs/[id]/matching - Get ranked candidates for a job
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const minScore = parseInt(searchParams.get('minScore') || '0');
  const semantic = searchParams.get('semantic') === 'true';
  const appliedFrom = searchParams.get('appliedFrom');
  const appliedTo = searchParams.get('appliedTo');

  try {
    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (semantic) {
      // Use vector similarity search
      const similar = await findSimilarCandidates(jobId, limit);
      return NextResponse.json({ candidates: similar, type: 'semantic' });
    }

    // If date filters are provided, first get candidate IDs that match the date range
    let filteredCandidateIds: string[] | undefined;
    if (appliedFrom || appliedTo) {
      const dateFilter: Record<string, Date> = {};
      if (appliedFrom) {
        dateFilter.gte = new Date(appliedFrom);
      }
      if (appliedTo) {
        const endDate = new Date(appliedTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }

      // Get candidate IDs from applications that match the date range for this job
      const matchingApplications = await prisma.application.findMany({
        where: {
          jobId,
          OR: [
            { appliedAt: dateFilter },
            { AND: [{ appliedAt: null }, { createdAt: dateFilter }] },
          ],
        },
        select: { candidateId: true },
      });

      filteredCandidateIds = matchingApplications.map((a) => a.candidateId);

      // If no candidates match the date filter, return empty results
      if (filteredCandidateIds.length === 0) {
        return NextResponse.json({
          candidates: [],
          total: 0,
          offset,
          limit,
          lastUpdated: null,
        });
      }
    }

    // Build where clause for count and query
    const matchWhereClause: Record<string, unknown> = {
      jobId,
      combinedScore: { gte: minScore },
    };
    if (filteredCandidateIds) {
      matchWhereClause.candidateId = { in: filteredCandidateIds };
    }

    // Get total count of matched candidates (with date filter if applicable)
    const totalCount = await prisma.jobCandidateMatch.count({
      where: matchWhereClause,
    });

    // Get cached ranked candidates
    const candidates = await getRankedCandidates(jobId, {
      limit,
      offset,
      minScore,
      candidateIds: filteredCandidateIds,
    });

    // Get the most recent update timestamp
    const lastMatch = await prisma.jobCandidateMatch.findFirst({
      where: { jobId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return NextResponse.json({
      candidates,
      total: totalCount,
      offset,
      limit,
      lastUpdated: lastMatch?.updatedAt?.toISOString() || null,
    });
  } catch (err) {
    console.error('Error getting ranked candidates:', err);
    return NextResponse.json(
      { error: 'Failed to get ranked candidates' },
      { status: 500 }
    );
  }
}

// POST /api/jobs/[id]/matching - Compute match scores
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = params;

  try {
    const body = await req.json();
    const { candidateId, refreshAll } = body;

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (refreshAll) {
      // Refresh all match scores for this job
      const updated = await updateMatchScoresForJob(jobId);
      return NextResponse.json({ success: true, updated });
    }

    if (candidateId) {
      // Compute score for specific candidate
      const scores = await computeMatchScore(candidateId, jobId);
      return NextResponse.json({ success: true, scores });
    }

    return NextResponse.json(
      { error: 'Either candidateId or refreshAll is required' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Error computing match scores:', err);
    return NextResponse.json(
      { error: 'Failed to compute match scores' },
      { status: 500 }
    );
  }
}
