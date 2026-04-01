import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const RATING_SCALE: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 4,
  4: 5,
};

const RECOMMENDATION_MAP: Record<string, string> = {
  STRONG_YES: 'STRONG_HIRE',
  YES: 'HIRE',
  NO: 'NO_HIRE',
  STRONG_NO: 'STRONG_NO_HIRE',
};

interface AttributeAnalysisItem {
  attributeId: string;
  evidence: string;
  suggestedRating: number;
}

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

    const aiSummary = await prisma.interviewAISummary.findUnique({
      where: { interviewId },
    });

    if (!aiSummary) {
      return NextResponse.json({ error: 'No AI summary found' }, { status: 404 });
    }

    // Map attributeAnalysis to scores
    const rawAnalysis = aiSummary.attributeAnalysis as unknown;
    const attributeAnalysis: AttributeAnalysisItem[] = Array.isArray(rawAnalysis) ? rawAnalysis : [];
    const scores: Record<string, number> = {};
    for (const item of attributeAnalysis) {
      if (item.attributeId && typeof item.suggestedRating === 'number') {
        scores[item.attributeId] = RATING_SCALE[item.suggestedRating] ?? 0;
      }
    }

    // Map recommendation
    const recommendation = RECOMMENDATION_MAP[aiSummary.recommendation] || aiSummary.recommendation;

    // Format strengths as bullet points
    const rawStrengths = aiSummary.strengths as unknown;
    const strengthsArray: string[] = Array.isArray(rawStrengths) ? rawStrengths : [];
    const strengths = strengthsArray.map((s) => `\u2022 ${s}`).join('\n');

    // Format concerns as bullet points
    const rawConcerns = aiSummary.concerns as unknown;
    const concernsArray: string[] = Array.isArray(rawConcerns) ? rawConcerns : [];
    const concerns = concernsArray.map((c) => `\u2022 ${c}`).join('\n');

    return NextResponse.json({
      scores,
      recommendation,
      strengths,
      concerns,
    });
  } catch (error) {
    console.error('AI suggestions GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load AI suggestions' },
      { status: 500 }
    );
  }
}
