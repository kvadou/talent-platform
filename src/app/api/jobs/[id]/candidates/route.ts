import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { searchParams } = new URL(req.url);

  // Parse filter params
  const stageId = searchParams.get('stageId');
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const search = searchParams.get('search');
  const appliedFrom = searchParams.get('appliedFrom');
  const appliedTo = searchParams.get('appliedTo');

  // Pagination params
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const skip = (page - 1) * limit;

  // Sort params (default: aiScore desc)
  const sortBy = searchParams.get('sortBy') || 'aiScore';
  const sortDir = searchParams.get('sortDir') || 'desc';

  // Build where clause
  const where: Record<string, unknown> = { jobId };

  if (stageId) {
    where.stageId = stageId;
  }

  if (status) {
    where.status = status;
  }

  if (source) {
    where.source = source;
  }

  if (search) {
    // Split search into words and require each word to match somewhere
    const searchWords = search.trim().split(/\s+/).filter(Boolean);
    if (searchWords.length === 1) {
      // Single word: match in firstName, lastName, or email
      where.candidate = {
        OR: [
          { firstName: { contains: searchWords[0], mode: 'insensitive' } },
          { lastName: { contains: searchWords[0], mode: 'insensitive' } },
          { email: { contains: searchWords[0], mode: 'insensitive' } },
        ],
      };
    } else {
      // Multiple words: each word must match in firstName, lastName, or email
      where.candidate = {
        AND: searchWords.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: 'insensitive' } },
            { lastName: { contains: word, mode: 'insensitive' } },
            { email: { contains: word, mode: 'insensitive' } },
          ],
        })),
      };
    }
  }

  // Date range filter - use appliedAt if available, fall back to createdAt
  if (appliedFrom || appliedTo) {
    const dateFilter: Record<string, Date> = {};
    if (appliedFrom) {
      dateFilter.gte = new Date(appliedFrom);
    }
    if (appliedTo) {
      // Set to end of day
      const endDate = new Date(appliedTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }
    // Filter on appliedAt (or createdAt for older records where appliedAt might not be set)
    where.OR = [
      { appliedAt: dateFilter },
      // Fall back to createdAt if appliedAt is null
      { AND: [{ appliedAt: null }, { createdAt: dateFilter }] },
    ];
  }

  // Build orderBy based on sort params
  let orderBy: any = { createdAt: 'desc' as const };

  if (sortBy === 'aiScore') {
    // Sort by aiScore with nulls last
    orderBy = { aiScore: { sort: sortDir as 'asc' | 'desc', nulls: 'last' } };
  } else if (sortBy === 'createdAt' || sortBy === 'appliedAt') {
    // Sort by appliedAt first, fall back to createdAt
    orderBy = [
      { appliedAt: { sort: sortDir as 'asc' | 'desc', nulls: 'last' } },
      { createdAt: sortDir as 'asc' | 'desc' },
    ];
  } else if (sortBy === 'name') {
    orderBy = [
      { candidate: { firstName: sortDir as 'asc' | 'desc' } },
      { candidate: { lastName: sortDir as 'asc' | 'desc' } },
    ];
  }

  // Get total count for pagination
  const totalCount = await prisma.application.count({ where });

  const applications = await prisma.application.findMany({
    where,
    select: {
      id: true,
      status: true,
      source: true,
      createdAt: true,
      appliedAt: true, // Actual application date from Greenhouse
      aiScore: true, // AI-generated application score
      aiScoreBreakdown: true,
      stageId: true,
      stage: {
        select: { id: true, name: true },
      },
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          tags: true,
        },
      },
      interviews: {
        select: { rating: true },
        orderBy: { scheduledAt: 'desc' },
        take: 1,
      },
      stageHistory: {
        orderBy: { movedAt: 'desc' },
        take: 1,
        select: { movedAt: true },
      },
    },
    orderBy,
    skip,
    take: limit,
  });

  // Fetch match scores for all candidates in this job
  const candidateIds = applications.map((app) => app.candidate.id);
  const matchScores = await prisma.jobCandidateMatch.findMany({
    where: {
      jobId,
      candidateId: { in: candidateIds },
    },
    select: {
      candidateId: true,
      combinedScore: true,
      keywordScore: true,
      embeddingScore: true,
    },
  });

  // Create a map for quick lookup
  const scoreMap = new Map(
    matchScores.map((m) => [m.candidateId, m])
  );

  // Add match scores to applications
  // Prefer aiScore (new) over JobCandidateMatch score (legacy)
  const applicationsWithScores = applications.map((app) => {
    const legacyScore = scoreMap.get(app.candidate.id);
    const rating = app.interviews[0]?.rating ?? null;
    const stageEnteredAt = app.stageHistory[0]?.movedAt ?? null;

    return {
      id: app.id,
      status: app.status,
      source: app.source,
      createdAt: app.appliedAt || app.createdAt, // Use appliedAt if available, fall back to createdAt
      appliedAt: app.appliedAt,
      rating,
      stageEnteredAt,
      stage: app.stage,
      candidate: app.candidate,
      aiScore: app.aiScore,
      aiScoreBreakdown: app.aiScoreBreakdown,
      // For backwards compatibility, provide matchScore from aiScore or legacy
      matchScore: app.aiScore
        ? { combinedScore: app.aiScore, keywordScore: null, embeddingScore: null }
        : legacyScore || null,
    };
  });

  return NextResponse.json({
    applications: applicationsWithScores,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: page * limit < totalCount,
    },
  });
}
