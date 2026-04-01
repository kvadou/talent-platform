import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JobBoardType } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/job-boards/[boardType]/posts - Get all posts for a specific board type
export async function GET(
  _: Request,
  { params }: { params: Promise<{ boardType: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardType } = await params;

    // Validate board type
    if (!Object.values(JobBoardType).includes(boardType as JobBoardType)) {
      return NextResponse.json({ error: 'Invalid board type' }, { status: 400 });
    }

    const posts = await prisma.jobPost.findMany({
      where: { boardType: boardType as JobBoardType },
      select: {
        id: true,
        jobId: true,
        title: true,
        location: true,
        status: true,
        applications: true,
        views: true,
        postedAt: true,
        expiresAt: true,
        externalUrl: true,
        job: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { postedAt: 'desc' }],
    });

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      jobId: post.jobId,
      jobTitle: post.job.title,
      title: post.title,
      location: post.location,
      status: post.status,
      applications: post.applications,
      views: post.views,
      postedAt: post.postedAt?.toISOString() || null,
      expiresAt: post.expiresAt?.toISOString() || null,
      externalUrl: post.externalUrl,
    }));

    return NextResponse.json({ posts: formattedPosts });
  } catch (error) {
    console.error('Error fetching board posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch board posts' },
      { status: 500 }
    );
  }
}
