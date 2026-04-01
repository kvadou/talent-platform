import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { z } from 'zod';
import { sendSMS, normalizePhoneNumber, isTwilioConfigured } from '@/lib/twilio';
import { generateFirstQuestion } from '@/lib/screening-conversation';

// Validation schema for creating sessions
const createSessionSchema = z.object({
  applicationId: z.string(),
  type: z.enum(['TEXT_SMS', 'TEXT_CHAT', 'TEXT_EMAIL', 'VOICE_ASYNC']),
  questionSetId: z.string().optional(),
  expiresInHours: z.number().min(1).max(168).optional().default(48), // Default 48 hours
  startImmediately: z.boolean().optional().default(false), // Send first SMS immediately
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  const status = searchParams.get('status');
  const jobId = searchParams.get('jobId');
  const needsReview = searchParams.get('needsReview') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};

  // Market access restriction through application
  if (access.marketIds) {
    where.application = {
      job: {
        marketId: { in: access.marketIds },
      },
    };
  }

  if (applicationId) {
    where.applicationId = applicationId;
  }

  if (status) {
    where.status = status;
  }

  if (jobId) {
    where.application = {
      ...where.application,
      jobId,
    };
  }

  // Sessions needing human review (completed with score 50-69)
  if (needsReview) {
    where.status = 'COMPLETED';
    where.humanDecision = null;
    where.aiScore = { gte: 50, lt: 70 };
  }

  const total = await prisma.aIScreeningSession.count({ where });

  const sessions = await prisma.aIScreeningSession.findMany({
    where,
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
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    sessions,
    pagination: { page, limit, total, totalPages },
  });
}

export async function POST(req: Request) {
  const authSession = await getSession();
  if (!authSession?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(authSession.user.email);

  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const { applicationId, type, questionSetId, expiresInHours, startImmediately } = parsed.data;

  // For SMS type, verify Twilio is configured
  if (type === 'TEXT_SMS' && !isTwilioConfigured()) {
    return NextResponse.json(
      { error: 'SMS screening requires Twilio to be configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' },
      { status: 400 }
    );
  }

  // Verify application exists and user has access
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { id: true, marketId: true, title: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (access.marketIds && !access.marketIds.includes(application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check for existing active session
  const existingSession = await prisma.aIScreeningSession.findFirst({
    where: {
      applicationId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_RESPONSE'] },
    },
  });

  if (existingSession) {
    return NextResponse.json(
      { error: 'An active screening session already exists for this application' },
      { status: 400 }
    );
  }

  // If no question set specified, find the default for the job or org
  let finalQuestionSetId = questionSetId;
  if (!finalQuestionSetId) {
    const defaultSet = await prisma.screeningQuestionSet.findFirst({
      where: {
        OR: [
          { jobId: application.job.id, isDefault: true },
          { jobId: null, isDefault: true },
        ],
      },
      orderBy: { jobId: 'desc' }, // Prefer job-specific over org-wide
    });
    finalQuestionSetId = defaultSet?.id;
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  // For SMS, get and normalize the candidate's phone
  let candidatePhone: string | null = null;
  if (type === 'TEXT_SMS') {
    if (!application.candidate.phone) {
      return NextResponse.json(
        { error: 'Candidate does not have a phone number on file. SMS screening requires a valid phone number.' },
        { status: 400 }
      );
    }
    candidatePhone = normalizePhoneNumber(application.candidate.phone);
  }

  const newSession = await prisma.aIScreeningSession.create({
    data: {
      applicationId,
      type,
      questionSetId: finalQuestionSetId || null,
      candidatePhone,
      expiresAt,
    },
    include: {
      application: {
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          job: { select: { id: true, title: true } },
        },
      },
      questionSet: {
        include: { questions: { orderBy: { order: 'asc' } } },
      },
    },
  });

  // If SMS and startImmediately, send the first message
  if (type === 'TEXT_SMS' && startImmediately && candidatePhone && newSession.questionSet) {
    try {
      // Build session object for generateFirstQuestion
      const sessionForQuestion = {
        id: newSession.id,
        status: newSession.status,
        application: {
          candidate: {
            firstName: newSession.application.candidate.firstName,
            lastName: newSession.application.candidate.lastName,
          },
          job: {
            id: newSession.application.job.id,
            title: newSession.application.job.title,
          },
        },
        questionSet: {
          questions: newSession.questionSet.questions.map((q) => ({
            id: q.id,
            order: q.order,
            question: q.question,
            questionType: q.questionType,
            options: q.options,
            isKnockout: q.isKnockout,
            knockoutAnswer: q.knockoutAnswer,
            knockoutMessage: q.knockoutMessage,
            evaluationPrompt: q.evaluationPrompt,
            minAcceptableScore: q.minAcceptableScore,
          })),
        },
        messages: [],
      };

      const firstQuestion = await generateFirstQuestion(sessionForQuestion);

      if (firstQuestion) {
        // Create greeting + first question message
        const greeting = `Hi ${newSession.application.candidate.firstName}! This is Acme Talent. We'd love to learn more about you for the ${newSession.application.job.title} position. Here's our first question:\n\n${firstQuestion}`;

        // Store the message
        await prisma.screeningMessage.create({
          data: {
            sessionId: newSession.id,
            role: 'AI',
            content: greeting,
            questionId: newSession.questionSet.questions[0]?.id,
            questionOrder: 1,
          },
        });

        // Update session status
        await prisma.aIScreeningSession.update({
          where: { id: newSession.id },
          data: {
            status: 'AWAITING_RESPONSE',
            startedAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        // Send SMS (async, don't block response)
        sendSMS(candidatePhone, greeting).catch((err) => {
          console.error('[SMS Screening] Failed to send initial message:', err);
        });
      }
    } catch (err) {
      console.error('[SMS Screening] Error starting session:', err);
      // Session is created but SMS may have failed - log but don't fail the request
    }
  }

  return NextResponse.json(newSession, { status: 201 });
}
