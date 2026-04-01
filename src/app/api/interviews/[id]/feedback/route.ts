import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// POST - Submit new feedback
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: interviewId } = await params;
    const body = await req.json();
    const { recommendation, scores, strengths, weaknesses, notes } = body;

    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation is required' }, { status: 400 });
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if interview exists
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            candidate: true,
            job: true,
          },
        },
      },
    });

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Check if feedback already exists
    const existingFeedback = await prisma.interviewFeedback.findFirst({
      where: {
        interviewId,
        userId: user.id,
      },
    });

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback already exists. Use PUT to update.' },
        { status: 409 }
      );
    }

    // Create feedback
    const feedback = await prisma.interviewFeedback.create({
      data: {
        interviewId,
        userId: user.id,
        recommendation,
        scores: scores || {},
        strengths: strengths || null,
        weaknesses: weaknesses || null,
        notes: notes || null,
        submittedAt: new Date(),
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        applicationId: interview.applicationId,
        userId: user.id,
        type: 'FEEDBACK_SUBMITTED',
        title: `Interview feedback submitted: ${recommendation}`,
        metadata: {
          interviewId,
          recommendation,
          interviewType: interview.type,
        },
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('Feedback POST error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

// PUT - Update existing feedback
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: interviewId } = await params;
    const body = await req.json();
    const { recommendation, scores, strengths, weaknesses, notes } = body;

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find existing feedback
    const existingFeedback = await prisma.interviewFeedback.findFirst({
      where: {
        interviewId,
        userId: user.id,
      },
    });

    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found. Use POST to create.' },
        { status: 404 }
      );
    }

    // Update feedback
    const feedback = await prisma.interviewFeedback.update({
      where: { id: existingFeedback.id },
      data: {
        recommendation: recommendation || existingFeedback.recommendation,
        scores: scores || existingFeedback.scores,
        strengths: strengths !== undefined ? strengths : existingFeedback.strengths,
        weaknesses: weaknesses !== undefined ? weaknesses : existingFeedback.weaknesses,
        notes: notes !== undefined ? notes : existingFeedback.notes,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Feedback PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}

// GET - Get feedback for an interview
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: interviewId } = await params;

    // Get all feedback for the interview
    const feedback = await prisma.interviewFeedback.findMany({
      where: { interviewId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Feedback GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load feedback' },
      { status: 500 }
    );
  }
}
