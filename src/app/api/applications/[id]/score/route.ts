import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { scoreApplication, ScoreBreakdown } from '@/lib/application-scoring';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/applications/[id]/score
 * Calculate AI score for an application
 * Also triggers auto-advance if the job has it enabled and score meets threshold
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Calculate score (also triggers auto-advance if enabled)
    const result = await scoreApplication(id);

    return NextResponse.json({
      success: true,
      score: result.breakdown.overallScore,
      breakdown: result.breakdown,
      autoAdvance: result.autoAdvance
        ? {
            advanced: result.autoAdvance.advanced,
            fromStage: result.autoAdvance.fromStage,
            toStage: result.autoAdvance.toStage,
            reason: result.autoAdvance.reason,
          }
        : undefined,
    });
  } catch (error) {
    console.error('Application scoring error:', error);
    return NextResponse.json(
      { error: 'Failed to score application' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/applications/[id]/score
 * Get existing score for an application
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        aiScore: true,
        aiScoreBreakdown: true,
        aiScoredAt: true,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    if (!application.aiScore) {
      return NextResponse.json(
        { error: 'Application has not been scored yet' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      score: application.aiScore,
      breakdown: application.aiScoreBreakdown as unknown as ScoreBreakdown,
      scoredAt: application.aiScoredAt,
    });
  } catch (error) {
    console.error('Get application score error:', error);
    return NextResponse.json(
      { error: 'Failed to get application score' },
      { status: 500 }
    );
  }
}
