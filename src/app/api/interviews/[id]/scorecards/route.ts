import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/interviews/[id]/scorecards
 * Get all scorecards for an interview (for comparison view)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: interviewId } = await params;

  // Get the current user to check if they can see private notes
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify interview exists
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          candidate: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          job: {
            include: {
              interviewKits: {
                include: {
                  categories: {
                    include: {
                      attributes: {
                        orderBy: { order: 'asc' },
                      },
                    },
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // Get all scorecards for this interview
  const scorecards = await prisma.interviewKitScorecard.findMany({
    where: { interviewId },
    include: {
      scorer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      ratings: {
        include: {
          attribute: {
            include: {
              category: true,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });

  // Hide private notes from other users
  const sanitizedScorecards = scorecards.map((sc) => ({
    ...sc,
    privateNotes: sc.scorerId === currentUser.id ? sc.privateNotes : null,
  }));

  // Find matching interview kit for attribute structure
  const matchingKit = interview.application.job.interviewKits.find(
    (kit) =>
      kit.type === interview.type ||
      kit.stageId === interview.application.stageId
  );

  // Build comparison data structure
  const attributes = matchingKit
    ? matchingKit.categories.flatMap((cat) =>
        cat.attributes.map((attr) => ({
          id: attr.id,
          name: attr.name,
          description: attr.description,
          categoryName: cat.name,
          categoryId: cat.id,
        }))
      )
    : [];

  // Calculate aggregated stats
  const stats = calculateAggregatedStats(scorecards, attributes);

  return NextResponse.json({
    interview: {
      id: interview.id,
      type: interview.type,
      scheduledAt: interview.scheduledAt,
      candidate: {
        name: `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`,
      },
      job: {
        title: interview.application.job.title,
      },
    },
    scorecards: sanitizedScorecards,
    attributes,
    stats,
  });
}

/**
 * Calculate aggregated statistics across all scorecards
 */
function calculateAggregatedStats(
  scorecards: Array<{
    overallRecommendation: string;
    ratings: Array<{
      attributeId: string;
      rating: number;
    }>;
  }>,
  attributes: Array<{ id: string; name: string }>
) {
  if (scorecards.length === 0) {
    return {
      totalScorecards: 0,
      recommendations: {},
      attributeAverages: {},
      overallAverage: null,
      consensus: null,
    };
  }

  // Count recommendations
  const recommendations: Record<string, number> = {};
  scorecards.forEach((sc) => {
    recommendations[sc.overallRecommendation] =
      (recommendations[sc.overallRecommendation] || 0) + 1;
  });

  // Calculate average rating per attribute
  const attributeAverages: Record<string, { average: number; count: number; scores: number[] }> = {};

  attributes.forEach((attr) => {
    const scores: number[] = [];
    scorecards.forEach((sc) => {
      const rating = sc.ratings.find((r) => r.attributeId === attr.id);
      if (rating) {
        scores.push(rating.rating);
      }
    });

    if (scores.length > 0) {
      attributeAverages[attr.id] = {
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
        scores,
      };
    }
  });

  // Calculate overall average
  const allRatings = scorecards.flatMap((sc) => sc.ratings.map((r) => r.rating));
  const overallAverage = allRatings.length > 0
    ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
    : null;

  // Determine consensus (most common recommendation)
  const maxCount = Math.max(...Object.values(recommendations));
  const consensusRecs = Object.entries(recommendations)
    .filter(([, count]) => count === maxCount)
    .map(([rec]) => rec);

  const consensus = consensusRecs.length === 1 ? consensusRecs[0] : null;

  return {
    totalScorecards: scorecards.length,
    recommendations,
    attributeAverages,
    overallAverage,
    consensus,
  };
}
