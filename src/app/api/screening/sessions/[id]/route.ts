import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { processScreeningResult } from '@/lib/automation/screening-actions';
import { z } from 'zod';

// Validation schema for updating sessions
const updateSessionSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'AWAITING_RESPONSE', 'COMPLETED', 'EXPIRED', 'HUMAN_TAKEOVER']).optional(),
  humanDecision: z.enum(['ADVANCE', 'SCHEDULE_CALL', 'REJECT', 'HOLD']).optional(),
  humanNotes: z.string().optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const authSession = await getSession();
  if (!authSession?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(authSession.user.email);

  const screeningSession = await prisma.aIScreeningSession.findUnique({
    where: { id: params.id },
    include: {
      application: {
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          job: { select: { id: true, title: true, marketId: true } },
        },
      },
      questionSet: {
        include: { questions: { orderBy: { order: 'asc' } } },
      },
      messages: { orderBy: { sentAt: 'asc' } },
      humanReviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!screeningSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Check market access
  if (access.marketIds && !access.marketIds.includes(screeningSession.application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(screeningSession);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const authSession = await getSession();
  if (!authSession?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const dbUser = await ensureUser();
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 401 });
  const access = await getUserMarkets(authSession.user.email);

  const body = await req.json();
  const parsed = updateSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const existing = await prisma.aIScreeningSession.findUnique({
    where: { id: params.id },
    include: {
      application: {
        include: { job: { select: { marketId: true } } },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Check market access
  if (access.marketIds && !access.marketIds.includes(existing.application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { status, humanDecision, humanNotes } = parsed.data;

  const updateData: any = { updatedAt: new Date() };

  if (status) {
    updateData.status = status;
    if (status === 'HUMAN_TAKEOVER') {
      updateData.humanReviewerId = dbUser.id;
    }
    if (status === 'COMPLETED' && !existing.completedAt) {
      updateData.completedAt = new Date();
    }
  }

  if (humanDecision) {
    updateData.humanDecision = humanDecision;
    updateData.humanReviewerId = dbUser.id;
    updateData.reviewedAt = new Date();
  }

  if (humanNotes !== undefined) {
    updateData.humanNotes = humanNotes;
  }

  const updatedSession = await prisma.aIScreeningSession.update({
    where: { id: params.id },
    data: updateData,
    include: {
      application: {
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          job: { select: { id: true, title: true } },
        },
      },
      questionSet: { select: { id: true, name: true } },
      humanReviewer: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { messages: true } },
    },
  });

  // Auto-process screening result when human makes a decision
  if (humanDecision) {
    try {
      await processScreeningResult(params.id);
    } catch (error) {
      console.error('Failed to process screening result:', error);
      // Don't fail the request - the decision was saved
    }
  }

  return NextResponse.json(updatedSession);
}

// Start or resume a screening session
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authSession = await getSession();
  if (!authSession?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(authSession.user.email);

  const screeningSession = await prisma.aIScreeningSession.findUnique({
    where: { id: params.id },
    include: {
      application: {
        include: {
          candidate: true,
          job: { select: { id: true, title: true, marketId: true } },
        },
      },
      questionSet: {
        include: { questions: { orderBy: { order: 'asc' } } },
      },
      messages: { orderBy: { sentAt: 'asc' } },
    },
  });

  if (!screeningSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Check market access
  if (access.marketIds && !access.marketIds.includes(screeningSession.application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Can only start pending sessions
  if (screeningSession.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Cannot start session in ${screeningSession.status} status` },
      { status: 400 }
    );
  }

  if (!screeningSession.questionSet || screeningSession.questionSet.questions.length === 0) {
    return NextResponse.json(
      { error: 'No question set configured for this session' },
      { status: 400 }
    );
  }

  // Update session status
  await prisma.aIScreeningSession.update({
    where: { id: params.id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  // Create initial greeting message
  const candidate = screeningSession.application.candidate;
  const greeting = `Hi ${candidate.firstName}! This is Acme Talent. We're excited about your application for the ${screeningSession.application.job.title} position. I have a few quick questions to help us get to know you better. Ready to begin?`;

  const firstMessage = await prisma.screeningMessage.create({
    data: {
      sessionId: params.id,
      role: 'AI',
      content: greeting,
    },
  });

  return NextResponse.json({
    session: {
      ...screeningSession,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
    message: firstMessage,
  });
}
