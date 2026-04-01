import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JobBoardType, JobPostStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

type BoardStats = {
  boardType: JobBoardType;
  boardName: string;
  totalPosts: number;
  livePosts: number;
  applications: number;
  views: number;
  status: 'connected' | 'not_connected' | 'pending';
  lastPostedAt: Date | null;
};

// Human-readable names for job board types
const BOARD_NAMES: Record<JobBoardType, string> = {
  INTERNAL: 'Career Page',
  INDEED: 'Indeed',
  LINKEDIN: 'LinkedIn',
  GOOGLE_JOBS: 'Google Jobs',
  GLASSDOOR: 'Glassdoor',
  ZIPRECRUITER: 'ZipRecruiter',
  OTHER: 'Other',
};

// GET /api/job-boards - Get aggregated job board statistics
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get aggregated stats for each board type
    const stats = await prisma.jobPost.groupBy({
      by: ['boardType'],
      _count: { id: true },
      _sum: { applications: true, views: true },
      _max: { postedAt: true },
    });

    // Get live posts count per board type
    const livePosts = await prisma.jobPost.groupBy({
      by: ['boardType'],
      where: { status: JobPostStatus.LIVE },
      _count: { id: true },
    });

    const livePostsMap = new Map(
      livePosts.map((lp) => [lp.boardType, lp._count.id])
    );

    // Build response with all board types
    const boardStats: BoardStats[] = Object.values(JobBoardType).map((boardType) => {
      const boardStat = stats.find((s) => s.boardType === boardType);
      const hasData = !!boardStat;

      return {
        boardType,
        boardName: BOARD_NAMES[boardType],
        totalPosts: boardStat?._count.id ?? 0,
        livePosts: livePostsMap.get(boardType) ?? 0,
        applications: boardStat?._sum.applications ?? 0,
        views: boardStat?._sum.views ?? 0,
        status: hasData ? 'connected' : 'not_connected',
        lastPostedAt: boardStat?._max.postedAt ?? null,
      };
    });

    // Sort: connected boards first, then by total posts
    boardStats.sort((a, b) => {
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (a.status !== 'connected' && b.status === 'connected') return 1;
      return b.totalPosts - a.totalPosts;
    });

    // Calculate totals
    const totals = {
      totalPosts: boardStats.reduce((sum, b) => sum + b.totalPosts, 0),
      livePosts: boardStats.reduce((sum, b) => sum + b.livePosts, 0),
      applications: boardStats.reduce((sum, b) => sum + b.applications, 0),
      views: boardStats.reduce((sum, b) => sum + b.views, 0),
      connectedBoards: boardStats.filter((b) => b.status === 'connected').length,
    };

    return NextResponse.json({ boards: boardStats, totals });
  } catch (error) {
    console.error('Error fetching job board stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job board statistics' },
      { status: 500 }
    );
  }
}
