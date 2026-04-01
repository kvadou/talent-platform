import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSurveySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  triggerEvent: z.enum(['after_application', 'after_interview', 'after_rejection', 'after_offer', 'manual']).default('after_application'),
  delayHours: z.number().min(0).default(24),
  isActive: z.boolean().default(true),
  questions: z.array(z.object({
    text: z.string().min(1),
    type: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'MULTI_SELECT', 'RATING', 'YES_NO']),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().default(true),
  })).optional(),
});

// GET /api/surveys - List all surveys
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const surveys = await prisma.candidateSurvey.findMany({
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate average rating for each survey
    const surveysWithStats = await Promise.all(
      surveys.map(async (survey) => {
        // Get average rating from rating-type questions
        const ratingQuestionIds = survey.questions
          .filter((q) => q.type === 'RATING')
          .map((q) => q.id);

        let avgRating = null;
        if (ratingQuestionIds.length > 0) {
          const ratingAnswers = await prisma.surveyAnswer.findMany({
            where: {
              questionId: { in: ratingQuestionIds },
            },
            select: { value: true },
          });

          if (ratingAnswers.length > 0) {
            const total = ratingAnswers.reduce((sum, a) => {
              const val = parseFloat(a.value);
              return sum + (isNaN(val) ? 0 : val);
            }, 0);
            avgRating = total / ratingAnswers.length;
          }
        }

        return {
          ...survey,
          responseCount: survey._count.responses,
          avgRating,
        };
      })
    );

    return NextResponse.json({ surveys: surveysWithStats });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    );
  }
}

// POST /api/surveys - Create new survey
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSurveySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { questions, ...surveyData } = parsed.data;

    const survey = await prisma.candidateSurvey.create({
      data: {
        ...surveyData,
        questions: questions
          ? {
              create: questions.map((q, index) => ({
                text: q.text,
                type: q.type,
                options: q.options || [],
                order: index + 1,
                isRequired: q.isRequired,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ survey }, { status: 201 });
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    );
  }
}
