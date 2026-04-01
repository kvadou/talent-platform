import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const interviewId = searchParams.get('interviewId');
  const applicationId = searchParams.get('applicationId');

  if (!interviewId && !applicationId) {
    return NextResponse.json({
      error: 'Either interviewId or applicationId is required'
    }, { status: 400 });
  }

  const where: any = {};
  if (interviewId) {
    where.interviewId = interviewId;
  } else if (applicationId) {
    where.interview = {
      applicationId
    };
  }

  const feedback = await prisma.interviewFeedback.findMany({
    where,
    include: {
      interview: {
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          interviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          scorecard: {
            select: {
              id: true,
              name: true,
              criteria: true
            }
          }
        }
      }
    },
    orderBy: { submittedAt: 'desc' }
  });

  return NextResponse.json({ feedback });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { interviewId, scores, recommendation, strengths, weaknesses, notes } = body;

  if (!interviewId || !scores) {
    return NextResponse.json({
      error: 'interviewId and scores are required'
    }, { status: 400 });
  }

  // Verify interview exists and user has access
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          job: {
            include: {
              market: true
            }
          }
        }
      }
    }
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // Check if user already submitted feedback for this interview
  const existingFeedback = await prisma.interviewFeedback.findFirst({
    where: {
      interviewId,
      userId: user.id
    }
  });

  if (existingFeedback) {
    return NextResponse.json({
      error: 'You have already submitted feedback for this interview. Use PATCH to update.'
    }, { status: 400 });
  }

  const feedback = await prisma.interviewFeedback.create({
    data: {
      interviewId,
      userId: user.id,
      scores,
      recommendation: recommendation || null,
      strengths: strengths || null,
      weaknesses: weaknesses || null,
      notes: notes || null
    },
    include: {
      interview: {
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          scorecard: {
            select: {
              name: true,
              criteria: true
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ feedback });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { id, scores, recommendation, strengths, weaknesses, notes } = body;

  if (!id) {
    return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
  }

  // Verify ownership - users can only update their own feedback
  const existing = await prisma.interviewFeedback.findFirst({
    where: { id, userId: user.id }
  });

  if (!existing) {
    return NextResponse.json({
      error: 'Feedback not found or you do not have permission to update it'
    }, { status: 404 });
  }

  const updateData: any = {};
  if (scores) updateData.scores = scores;
  if (recommendation !== undefined) updateData.recommendation = recommendation;
  if (strengths !== undefined) updateData.strengths = strengths;
  if (weaknesses !== undefined) updateData.weaknesses = weaknesses;
  if (notes !== undefined) updateData.notes = notes;

  const feedback = await prisma.interviewFeedback.update({
    where: { id },
    data: updateData,
    include: {
      interview: {
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          scorecard: {
            select: {
              name: true,
              criteria: true
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ feedback });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.interviewFeedback.findFirst({
    where: { id, userId: user.id }
  });

  if (!existing) {
    return NextResponse.json({
      error: 'Feedback not found or you do not have permission to delete it'
    }, { status: 404 });
  }

  await prisma.interviewFeedback.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}
