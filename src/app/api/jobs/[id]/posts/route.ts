import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessJob } from '@/lib/api-auth';
import { JobPostStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET /api/jobs/[id]/posts - List all posts for a job
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;
    if (!(await canAccessJob(session.user.email, jobId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const posts = await prisma.jobPost.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching job posts:', error);
    return NextResponse.json({ error: 'Failed to fetch job posts' }, { status: 500 });
  }
}

// POST /api/jobs/[id]/posts - Create a new job post
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;
    if (!(await canAccessJob(session.user.email, jobId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const { boardType, title, content, location, expiresAt } = body;

    if (!boardType) {
      return NextResponse.json({ error: 'boardType is required' }, { status: 400 });
    }

    // Board name mapping
    const boardNames: Record<string, string> = {
      INTERNAL: 'Career Page',
      INDEED: 'Indeed',
      LINKEDIN: 'LinkedIn',
      GOOGLE_JOBS: 'Google Jobs',
      GLASSDOOR: 'Glassdoor',
      ZIPRECRUITER: 'ZipRecruiter',
      OTHER: 'Other',
    };

    const post = await prisma.jobPost.create({
      data: {
        jobId,
        boardType,
        boardName: boardNames[boardType] || boardType,
        title: title || null,
        content: content || null,
        location: location || null,
        status: JobPostStatus.DRAFT,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Error creating job post:', error);
    return NextResponse.json({ error: 'Failed to create job post' }, { status: 500 });
  }
}
