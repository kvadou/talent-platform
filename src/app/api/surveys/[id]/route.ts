import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSurveySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  triggerEvent: z.enum(['after_application', 'after_interview', 'after_rejection', 'after_offer', 'manual']).optional(),
  delayHours: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  questions: z.array(z.object({
    id: z.string().optional(),
    text: z.string().min(1),
    type: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'MULTI_SELECT', 'RATING', 'YES_NO']),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().default(true),
  })).optional(),
});

// GET /api/surveys/[id] - Get survey details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const survey = await prisma.candidateSurvey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    return NextResponse.json({ survey });
  } catch (error) {
    console.error('Error fetching survey:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    );
  }
}

// PUT /api/surveys/[id] - Update survey
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSurveySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { questions, ...surveyData } = parsed.data;

    // If questions are provided, we need to handle them specially
    if (questions) {
      // Delete all existing questions and recreate
      await prisma.surveyQuestion.deleteMany({
        where: { surveyId: id },
      });

      // Create new questions
      await prisma.surveyQuestion.createMany({
        data: questions.map((q, index) => ({
          surveyId: id,
          text: q.text,
          type: q.type,
          options: q.options || [],
          order: index + 1,
          isRequired: q.isRequired,
        })),
      });
    }

    // Update survey fields
    const survey = await prisma.candidateSurvey.update({
      where: { id },
      data: surveyData,
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ survey });
  } catch (error) {
    console.error('Error updating survey:', error);
    return NextResponse.json(
      { error: 'Failed to update survey' },
      { status: 500 }
    );
  }
}

// DELETE /api/surveys/[id] - Delete survey
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.candidateSurvey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json(
      { error: 'Failed to delete survey' },
      { status: 500 }
    );
  }
}
