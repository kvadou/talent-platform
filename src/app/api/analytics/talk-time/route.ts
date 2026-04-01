import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { prisma } from '@/lib/prisma';
import { computeTalkTime } from '@/lib/talk-time';
import { TranscriptSegment } from '@/lib/whisper';

interface InterviewerAgg {
  id: string;
  name: string;
  email: string;
  totalInterviewerPercent: number;
  totalInterviews: number;
  flaggedCount: number;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const interviewerId = searchParams.get('interviewerId');

  // Build where clause
  const where: Record<string, unknown> = {
    recording: {
      transcript: { isNot: null },
    },
  };

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.scheduledAt = dateFilter;
  }

  if (interviewerId) {
    where.interviewerId = interviewerId;
  }

  // Market scoping
  if (access.marketIds && access.marketIds.length > 0) {
    where.application = {
      job: { marketId: { in: access.marketIds } },
    };
  }

  const interviews = await prisma.interview.findMany({
    where,
    include: {
      interviewer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      recording: {
        include: { transcript: true },
      },
    },
  });

  // Aggregate per interviewer
  const interviewerMap = new Map<string, InterviewerAgg>();

  let overallTotalPercent = 0;
  let overallCount = 0;
  let overallFlagged = 0;

  for (const interview of interviews) {
    if (!interview.recording?.transcript) continue;

    const segments = interview.recording.transcript.segments as unknown as TranscriptSegment[];
    if (!Array.isArray(segments) || segments.length === 0) continue;

    const stats = computeTalkTime(segments);
    const interviewerInfo = interview.interviewer;
    const key = interviewerInfo.id;

    let agg = interviewerMap.get(key);
    if (!agg) {
      agg = {
        id: interviewerInfo.id,
        name: `${interviewerInfo.firstName} ${interviewerInfo.lastName}`.trim(),
        email: interviewerInfo.email,
        totalInterviewerPercent: 0,
        totalInterviews: 0,
        flaggedCount: 0,
      };
      interviewerMap.set(key, agg);
    }

    agg.totalInterviewerPercent += stats.interviewerPercent;
    agg.totalInterviews += 1;
    if (stats.interviewerPercent > 50) {
      agg.flaggedCount += 1;
    }

    overallTotalPercent += stats.interviewerPercent;
    overallCount += 1;
    if (stats.interviewerPercent > 50) {
      overallFlagged += 1;
    }
  }

  // Build response sorted by interview count desc
  const interviewers = Array.from(interviewerMap.values())
    .map((agg) => ({
      id: agg.id,
      name: agg.name,
      email: agg.email,
      avgInterviewerPercent: agg.totalInterviews > 0
        ? Math.round(agg.totalInterviewerPercent / agg.totalInterviews)
        : 0,
      totalInterviews: agg.totalInterviews,
      flaggedCount: agg.flaggedCount,
    }))
    .sort((a, b) => b.totalInterviews - a.totalInterviews);

  return NextResponse.json({
    interviewers,
    overall: {
      avgInterviewerPercent: overallCount > 0
        ? Math.round(overallTotalPercent / overallCount)
        : 0,
      totalInterviews: overallCount,
      totalFlagged: overallFlagged,
    },
  });
}
