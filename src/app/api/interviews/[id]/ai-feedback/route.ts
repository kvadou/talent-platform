import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAnyRole, requireApiUser } from '@/lib/api-auth';
import { getUserMarkets } from '@/lib/market-scope';

// Schema for AI feedback submission
const aiFeedbackSchema = z.object({
  // Required: what the AI recommended
  aiRecommendation: z.enum(['STRONG_YES', 'YES', 'NO', 'STRONG_NO']),
  aiScore: z.number().min(0).max(100),

  // Optional: what the human decided (can be populated later from scorecard)
  humanRecommendation: z.enum(['STRONG_YES', 'YES', 'NO', 'STRONG_NO']).optional().nullable(),
  humanScore: z.number().min(0).max(100).optional().nullable(),

  // Explicit feedback
  wasAIHelpful: z.boolean().optional().nullable(),
  feedbackType: z.enum(['AGREE', 'DISAGREE_TOO_HIGH', 'DISAGREE_TOO_LOW', 'PARTIALLY_AGREE']).optional().nullable(),
  feedbackNotes: z.string().optional().nullable(),

  // Specific corrections
  incorrectStrengths: z.array(z.string()).optional().nullable(),
  missedStrengths: z.array(z.string()).optional().nullable(),
  incorrectConcerns: z.array(z.string()).optional().nullable(),
  missedConcerns: z.array(z.string()).optional().nullable(),
});

async function canAccessInterview(userEmail: string, interviewId: string): Promise<boolean> {
  const access = await getUserMarkets(userEmail);
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      ...(access.marketIds
        ? { application: { job: { marketId: { in: access.marketIds } } } }
        : {}),
    },
    select: { id: true },
  });
  return !!interview;
}

// GET - Retrieve AI feedback for an interview
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!(await canAccessInterview(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const feedback = await prisma.aIRecommendationFeedback.findMany({
    where: { interviewId: id },
    orderBy: { createdAt: 'desc' },
  });

  // Also get the AI summary for context
  const aiSummary = await prisma.interviewAISummary.findUnique({
    where: { interviewId: id },
    select: {
      recommendation: true,
      recommendationScore: true,
      strengths: true,
      concerns: true,
    },
  });

  return NextResponse.json({ feedback, aiSummary });
}

// POST - Submit new AI feedback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER', 'HIRING_MANAGER']);
  if (forbidden) return forbidden;
  const { id } = await params;
  if (!(await canAccessInterview(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify interview exists and has an AI summary
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      aiSummary: true,
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = aiFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Helper to convert null arrays to Prisma.JsonNull or undefined
  const toJson = (arr: string[] | null | undefined): Prisma.InputJsonValue | undefined => {
    if (arr === null || arr === undefined) return undefined;
    return arr;
  };

  const feedback = await prisma.aIRecommendationFeedback.create({
    data: {
      interviewId: id,
      aiRecommendation: data.aiRecommendation,
      aiScore: data.aiScore,
      humanRecommendation: data.humanRecommendation,
      humanScore: data.humanScore,
      wasAIHelpful: data.wasAIHelpful,
      feedbackType: data.feedbackType,
      feedbackNotes: data.feedbackNotes,
      incorrectStrengths: toJson(data.incorrectStrengths),
      missedStrengths: toJson(data.missedStrengths),
      incorrectConcerns: toJson(data.incorrectConcerns),
      missedConcerns: toJson(data.missedConcerns),
    },
  });

  return NextResponse.json({ feedback });
}

// Helper endpoint to auto-populate feedback when scorecard is submitted
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER', 'HIRING_MANAGER']);
  if (forbidden) return forbidden;
  const { id } = await params;
  if (!(await canAccessInterview(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the interview with AI summary and latest scorecard
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      aiSummary: true,
      kitScorecards: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.aiSummary) {
    return NextResponse.json({ error: 'No AI summary for this interview' }, { status: 400 });
  }

  const aiSummary = interview.aiSummary;
  const scorecard = interview.kitScorecards[0];

  // Map overall recommendation to human format
  const recommendationMap: Record<string, string> = {
    STRONG_YES: 'STRONG_YES',
    YES: 'YES',
    NO: 'NO',
    STRONG_NO: 'STRONG_NO',
  };

  const body = await request.json();

  // Helper to convert null arrays to undefined for Prisma JSON fields
  const toJson = (arr: string[] | null | undefined): Prisma.InputJsonValue | undefined => {
    if (arr === null || arr === undefined) return undefined;
    return arr;
  };

  // Create feedback record with AI data pre-populated and human data from scorecard
  const feedback = await prisma.aIRecommendationFeedback.create({
    data: {
      interviewId: id,
      aiRecommendation: aiSummary.recommendation,
      aiScore: aiSummary.recommendationScore,
      humanRecommendation: scorecard ? recommendationMap[scorecard.overallRecommendation] : null,
      humanScore: null, // Would need to calculate from individual ratings
      wasAIHelpful: body.wasAIHelpful,
      feedbackType: body.feedbackType,
      feedbackNotes: body.feedbackNotes,
      incorrectStrengths: toJson(body.incorrectStrengths),
      missedStrengths: toJson(body.missedStrengths),
      incorrectConcerns: toJson(body.incorrectConcerns),
      missedConcerns: toJson(body.missedConcerns),
    },
  });

  return NextResponse.json({ feedback });
}
