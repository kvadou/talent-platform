import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSession, ensureUser } from '@/lib/auth';
import { z } from 'zod';

// Validation schema for updating question sets
const questionSchema = z.object({
  id: z.string().optional(), // Existing question ID for updates
  question: z.string().min(1),
  questionType: z.enum(['OPEN_ENDED', 'MULTIPLE_CHOICE', 'YES_NO', 'AVAILABILITY', 'SALARY_EXPECTATION']),
  options: z.array(z.string()).optional().nullable(),
  isKnockout: z.boolean().optional().default(false),
  knockoutAnswer: z.string().optional().nullable(),
  knockoutMessage: z.string().optional().nullable(),
  evaluationPrompt: z.string().optional().nullable(),
  minAcceptableScore: z.number().min(0).max(100).optional().nullable(),
  conditionalFollowUp: z.boolean().optional().default(false),
  followUpCondition: z.any().optional().nullable(),
  followUpQuestionId: z.string().optional().nullable(),
});

const updateQuestionSetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  questions: z.array(questionSchema).optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const questionSet = await prisma.screeningQuestionSet.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { id: true, title: true } },
      questions: { orderBy: { order: 'asc' } },
      _count: { select: { sessions: true } },
    },
  });

  if (!questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  return NextResponse.json(questionSet);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const body = await req.json();
  const parsed = updateQuestionSetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const existing = await prisma.screeningQuestionSet.findUnique({
    where: { id: params.id },
    include: { questions: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  const { name, description, jobId, isDefault, questions } = parsed.data;

  // If setting as default, unset any existing defaults for this job scope
  if (isDefault) {
    const scopeJobId = jobId !== undefined ? jobId : existing.jobId;
    await prisma.screeningQuestionSet.updateMany({
      where: {
        id: { not: params.id },
        ...(scopeJobId ? { jobId: scopeJobId } : { jobId: null }),
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  // Use a transaction to update the question set and its questions
  const questionSet = await prisma.$transaction(async (tx) => {
    // Update the question set
    const updated = await tx.screeningQuestionSet.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(jobId !== undefined && { jobId }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    // If questions are provided, sync them
    if (questions) {
      // Get IDs of questions that should remain
      const keepIds = questions.filter((q) => q.id).map((q) => q.id!);

      // Delete questions not in the new list
      await tx.screeningQuestion.deleteMany({
        where: {
          questionSetId: params.id,
          id: { notIn: keepIds },
        },
      });

      // Upsert questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q.id) {
          // Update existing question
          await tx.screeningQuestion.update({
            where: { id: q.id },
            data: {
              order: i + 1,
              question: q.question,
              questionType: q.questionType,
              options: q.options ? q.options : Prisma.JsonNull,
              isKnockout: q.isKnockout || false,
              knockoutAnswer: q.knockoutAnswer || null,
              knockoutMessage: q.knockoutMessage || null,
              evaluationPrompt: q.evaluationPrompt || null,
              minAcceptableScore: q.minAcceptableScore ?? null,
              conditionalFollowUp: q.conditionalFollowUp || false,
              followUpCondition: q.followUpCondition ? q.followUpCondition : Prisma.JsonNull,
              followUpQuestionId: q.followUpQuestionId || null,
            },
          });
        } else {
          // Create new question
          await tx.screeningQuestion.create({
            data: {
              questionSetId: params.id,
              order: i + 1,
              question: q.question,
              questionType: q.questionType,
              options: q.options ? q.options : Prisma.JsonNull,
              isKnockout: q.isKnockout || false,
              knockoutAnswer: q.knockoutAnswer || null,
              knockoutMessage: q.knockoutMessage || null,
              evaluationPrompt: q.evaluationPrompt || null,
              minAcceptableScore: q.minAcceptableScore ?? null,
              conditionalFollowUp: q.conditionalFollowUp || false,
              followUpCondition: q.followUpCondition ? q.followUpCondition : Prisma.JsonNull,
              followUpQuestionId: q.followUpQuestionId || null,
            },
          });
        }
      }
    }

    return updated;
  });

  // Fetch the complete updated question set
  const result = await prisma.screeningQuestionSet.findUnique({
    where: { id: params.id },
    include: {
      job: { select: { id: true, title: true } },
      questions: { orderBy: { order: 'asc' } },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();

  const existing = await prisma.screeningQuestionSet.findUnique({
    where: { id: params.id },
    include: { _count: { select: { sessions: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
  }

  // Don't allow deletion if there are active sessions
  if (existing._count.sessions > 0) {
    return NextResponse.json(
      { error: 'Cannot delete question set with existing sessions. Archive it instead.' },
      { status: 400 }
    );
  }

  await prisma.screeningQuestionSet.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
