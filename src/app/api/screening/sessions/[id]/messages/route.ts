import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { processScreeningResponse } from '@/lib/screening-conversation';
import { z } from 'zod';

// Validation schema for sending messages
const sendMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(['CANDIDATE', 'RECRUITER']).optional().default('CANDIDATE'),
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
        include: { job: { select: { marketId: true } } },
      },
    },
  });

  if (!screeningSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Check market access
  if (access.marketIds && !access.marketIds.includes(screeningSession.application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = await prisma.screeningMessage.findMany({
    where: { sessionId: params.id },
    orderBy: { sentAt: 'asc' },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authSession = await getSession();
  if (!authSession?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(authSession.user.email);

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const { content, role } = parsed.data;

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

  // Check session is active
  if (!['IN_PROGRESS', 'AWAITING_RESPONSE', 'HUMAN_TAKEOVER'].includes(screeningSession.status)) {
    return NextResponse.json(
      { error: `Cannot send messages to session in ${screeningSession.status} status` },
      { status: 400 }
    );
  }

  // Save the incoming message
  const candidateMessage = await prisma.screeningMessage.create({
    data: {
      sessionId: params.id,
      role: role === 'RECRUITER' ? 'RECRUITER' : 'CANDIDATE',
      content,
      deliveredAt: new Date(),
    },
  });

  // Update session activity
  await prisma.aIScreeningSession.update({
    where: { id: params.id },
    data: { lastActivityAt: new Date() },
  });

  // If recruiter is talking, don't generate AI response
  if (role === 'RECRUITER') {
    return NextResponse.json({
      candidateMessage,
      aiResponse: null,
    });
  }

  // Process the response and generate AI reply
  try {
    const result = await processScreeningResponse(screeningSession, content, candidateMessage.id);

    return NextResponse.json({
      candidateMessage,
      aiResponse: result.aiMessage,
      analysis: result.analysis,
      sessionUpdate: result.sessionUpdate,
    });
  } catch (error) {
    console.error('Failed to process screening response:', error);

    // Still return the candidate message even if AI fails
    return NextResponse.json({
      candidateMessage,
      aiResponse: null,
      error: 'Failed to generate AI response',
    });
  }
}
