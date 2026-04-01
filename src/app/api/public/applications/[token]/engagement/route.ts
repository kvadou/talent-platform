import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

// Track candidate engagement on their status portal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(request);
    const limitResult = await rateLimit(`portal-engagement:${ip}`, 180, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const body = await request.json();
    const { type, timeSpent, puzzleEvent, streak, timezone } = body;

    // Find the application by portal token
    const tokenHash = hashToken(token);
    const appToken = await prisma.applicationToken.findUnique({
      where: { token: tokenHash },
      select: { applicationId: true, createdAt: true, expiresAt: true },
    });

    if (!appToken || isTokenExpired(appToken.createdAt, appToken.expiresAt)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const applicationId = appToken.applicationId;

    // Get or create engagement record
    let engagement = await prisma.candidateEngagement.findUnique({
      where: { applicationId },
    });

    if (!engagement) {
      engagement = await prisma.candidateEngagement.create({
        data: {
          applicationId,
          totalViews: 0,
          uniqueViewDays: 0,
          totalTimeSpent: 0,
          puzzlesAttempted: 0,
          puzzlesSolved: 0,
          puzzleBestStreak: 0,
        },
      });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const lastViewDate = engagement.lastViewedAt?.toISOString().split('T')[0];

    // Update based on event type
    switch (type) {
      case 'view': {
        // Increment view count
        const isNewDay = lastViewDate !== today;
        await prisma.candidateEngagement.update({
          where: { applicationId },
          data: {
            totalViews: { increment: 1 },
            lastViewedAt: now,
            uniqueViewDays: isNewDay ? { increment: 1 } : undefined,
          },
        });

        // Auto-detect candidate timezone from browser
        if (timezone && typeof timezone === 'string') {
          const application = await prisma.application.findUnique({
            where: { id: applicationId },
            select: { candidateId: true, candidate: { select: { timezone: true } } },
          });
          // Only set if not already manually set (null means never set)
          if (application && !application.candidate.timezone) {
            await prisma.candidate.update({
              where: { id: application.candidateId },
              data: { timezone },
            });
          }
        }
        break;
      }

      case 'heartbeat':
      case 'leave': {
        // Update time spent and puzzle stats
        const updates: any = {};

        if (timeSpent && timeSpent > 0) {
          // Only increment by the delta since last update (approximate)
          // We store total session time, so take max of current and new
          updates.totalTimeSpent = Math.max(engagement.totalTimeSpent, timeSpent);
        }

        if (puzzleEvent === 'attempted') {
          updates.puzzlesAttempted = { increment: 1 };
        } else if (puzzleEvent === 'solved') {
          updates.puzzlesAttempted = { increment: 1 };
          updates.puzzlesSolved = { increment: 1 };
          if (streak && streak > engagement.puzzleBestStreak) {
            updates.puzzleBestStreak = streak;
          }
        }

        if (Object.keys(updates).length > 0) {
          await prisma.candidateEngagement.update({
            where: { applicationId },
            data: updates,
          });
        }
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking engagement:', error);
    return NextResponse.json({ error: 'Failed to track engagement' }, { status: 500 });
  }
}

// Get engagement stats (for ATS display)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(request);
    const limitResult = await rateLimit(`portal-engagement-read:${ip}`, 120, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;

    // Find the application by portal token
    const getTokenHash = hashToken(token);
    const appToken = await prisma.applicationToken.findUnique({
      where: { token: getTokenHash },
      select: { applicationId: true, createdAt: true, expiresAt: true },
    });

    if (!appToken || isTokenExpired(appToken.createdAt, appToken.expiresAt)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const engagement = await prisma.candidateEngagement.findUnique({
      where: { applicationId: appToken.applicationId },
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
