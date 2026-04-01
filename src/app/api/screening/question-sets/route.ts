import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSession, ensureUser } from '@/lib/auth';
import { z } from 'zod';

// Validation schema for creating/updating question sets
const questionSchema = z.object({
  question: z.string().min(1),
  questionType: z.enum(['OPEN_ENDED', 'MULTIPLE_CHOICE', 'YES_NO', 'AVAILABILITY', 'SALARY_EXPECTATION']),
  options: z.array(z.string()).optional(),
  isKnockout: z.boolean().optional().default(false),
  knockoutAnswer: z.string().optional(),
  knockoutMessage: z.string().optional(),
  evaluationPrompt: z.string().optional(),
  minAcceptableScore: z.number().min(0).max(100).optional(),
  conditionalFollowUp: z.boolean().optional().default(false),
  followUpCondition: z.any().optional(),
  followUpQuestionId: z.string().optional(),
});

const questionSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  jobId: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  questions: z.array(questionSchema).optional(),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const includeDefault = searchParams.get('includeDefault') !== 'false';

  // Build where clause
  const where: any = {};

  if (jobId) {
    // Get question sets for specific job + defaults
    where.OR = [{ jobId }];
    if (includeDefault) {
      where.OR.push({ isDefault: true });
    }
  }

  const questionSets = await prisma.screeningQuestionSet.findMany({
    where,
    include: {
      job: { select: { id: true, title: true } },
      questions: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { sessions: true },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ questionSets });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const body = await req.json();
  const parsed = questionSetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const { name, description, jobId, isDefault, questions } = parsed.data;

  // If setting as default, unset any existing defaults for this job scope
  if (isDefault) {
    await prisma.screeningQuestionSet.updateMany({
      where: jobId ? { jobId, isDefault: true } : { jobId: null, isDefault: true },
      data: { isDefault: false },
    });
  }

  const questionSet = await prisma.screeningQuestionSet.create({
    data: {
      name,
      description: description || null,
      jobId: jobId || null,
      isDefault: isDefault || false,
      questions: questions
        ? {
            create: questions.map((q, index) => ({
              order: index + 1,
              question: q.question,
              questionType: q.questionType,
              options: q.options ? q.options : Prisma.JsonNull,
              isKnockout: q.isKnockout || false,
              knockoutAnswer: q.knockoutAnswer || null,
              knockoutMessage: q.knockoutMessage || null,
              evaluationPrompt: q.evaluationPrompt || null,
              minAcceptableScore: q.minAcceptableScore || null,
              conditionalFollowUp: q.conditionalFollowUp || false,
              followUpCondition: q.followUpCondition ? q.followUpCondition : Prisma.JsonNull,
              followUpQuestionId: q.followUpQuestionId || null,
            })),
          }
        : undefined,
    },
    include: {
      job: { select: { id: true, title: true } },
      questions: { orderBy: { order: 'asc' } },
    },
  });

  return NextResponse.json(questionSet, { status: 201 });
}
