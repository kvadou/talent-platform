import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

// POST - Submit a new Interview Kit scorecard
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id: interviewId } = await params;
  const body = await req.json();
  const { keyTakeaways, privateNotes, overallRecommendation, ratings, isDraft } = body;

  if (!isDraft && !overallRecommendation) {
    return NextResponse.json({ error: 'Overall recommendation is required' }, { status: 400 });
  }

  // Check if the interview exists
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // Check if user already has a scorecard — if so, update it instead of creating a new one
  const existingScorecard = await prisma.interviewKitScorecard.findFirst({
    where: {
      interviewId,
      scorerId: dbUser.id,
    },
  });

  if (existingScorecard) {
    // Auto-save: update existing scorecard
    const updated = await prisma.interviewKitScorecard.update({
      where: { id: existingScorecard.id },
      data: {
        keyTakeaways,
        privateNotes,
        ...(overallRecommendation && { overallRecommendation }),
        ...(!isDraft && { submittedAt: new Date() }),
      },
    });
    return NextResponse.json(updated);
  }

  // Create the scorecard with ratings
  const scorecard = await prisma.interviewKitScorecard.create({
    data: {
      interviewId,
      scorerId: dbUser.id,
      keyTakeaways,
      privateNotes,
      overallRecommendation: overallRecommendation || 'NO',
      ...(!isDraft && { submittedAt: new Date() }),
      ratings: ratings?.length ? {
        create: ratings.map((r: { attributeId: string; rating: number; notes?: string; aiSuggested?: number }) => ({
          attributeId: r.attributeId,
          rating: r.rating,
          notes: r.notes || null,
          aiSuggested: r.aiSuggested || null,
        })),
      } : undefined,
    },
    include: {
      scorer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      ratings: {
        include: {
          attribute: true,
        },
      },
    },
  });

  return NextResponse.json(scorecard, { status: 201 });
}

// PUT - Update an existing Interview Kit scorecard
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id: interviewId } = await params;
  const body = await req.json();
  const { keyTakeaways, privateNotes, overallRecommendation, ratings, isDraft } = body;

  // Find the user's scorecard for this interview
  const existingScorecard = await prisma.interviewKitScorecard.findFirst({
    where: {
      interviewId,
      scorerId: dbUser.id,
    },
  });

  if (!existingScorecard) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  // Update scorecard in a transaction
  const scorecard = await prisma.$transaction(async (tx) => {
    // Update the main scorecard
    await tx.interviewKitScorecard.update({
      where: { id: existingScorecard.id },
      data: {
        keyTakeaways,
        privateNotes,
        ...(overallRecommendation && { overallRecommendation }),
        ...(!isDraft && { submittedAt: new Date() }),
      },
    });

    // If ratings are provided, replace them
    if (ratings !== undefined) {
      await tx.interviewKitRating.deleteMany({
        where: { scorecardId: existingScorecard.id },
      });

      if (ratings.length > 0) {
        await tx.interviewKitRating.createMany({
          data: ratings.map((r: { attributeId: string; rating: number; notes?: string; aiSuggested?: number }) => ({
            scorecardId: existingScorecard.id,
            attributeId: r.attributeId,
            rating: r.rating,
            notes: r.notes || null,
            aiSuggested: r.aiSuggested || null,
          })),
        });
      }
    }

    return tx.interviewKitScorecard.findUnique({
      where: { id: existingScorecard.id },
      include: {
        scorer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        ratings: {
          include: {
            attribute: true,
          },
        },
      },
    });
  });

  return NextResponse.json(scorecard);
}

// GET - Get the current user's scorecard for this interview
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id: interviewId } = await params;

  const scorecard = await prisma.interviewKitScorecard.findFirst({
    where: {
      interviewId,
      scorerId: dbUser.id,
    },
    include: {
      scorer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      ratings: {
        include: {
          attribute: true,
        },
      },
    },
  });

  if (!scorecard) {
    return NextResponse.json({ scorecard: null });
  }

  return NextResponse.json({ scorecard });
}
