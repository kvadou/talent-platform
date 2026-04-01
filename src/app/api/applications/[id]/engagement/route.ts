import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Get engagement stats for an application (ATS users only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const engagement = await prisma.candidateEngagement.findUnique({
      where: { applicationId: id },
    });

    if (!engagement) {
      return NextResponse.json({
        engagement: {
          totalViews: 0,
          lastViewedAt: null,
          uniqueViewDays: 0,
          totalTimeSpent: 0,
          puzzlesAttempted: 0,
          puzzlesSolved: 0,
          puzzleBestStreak: 0,
        },
      });
    }

    return NextResponse.json({
      engagement: {
        totalViews: engagement.totalViews,
        lastViewedAt: engagement.lastViewedAt?.toISOString() || null,
        uniqueViewDays: engagement.uniqueViewDays,
        totalTimeSpent: engagement.totalTimeSpent,
        puzzlesAttempted: engagement.puzzlesAttempted,
        puzzlesSolved: engagement.puzzlesSolved,
        puzzleBestStreak: engagement.puzzleBestStreak,
      },
    });
  } catch (error) {
    console.error('Error fetching engagement:', error);
    return NextResponse.json({ error: 'Failed to fetch engagement' }, { status: 500 });
  }
}
