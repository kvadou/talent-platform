import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessJob } from '@/lib/api-auth';
import { JobPostStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// PUT /api/jobs/[id]/posts/[postId] - Update a job post
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId, postId } = await params;
    if (!(await canAccessJob(session.user.email, jobId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify post belongs to this job
    const existing = await prisma.jobPost.findFirst({
      where: { id: postId, jobId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content, location, status, expiresAt } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title || null;
    if (content !== undefined) updateData.content = content || null;
    if (location !== undefined) updateData.location = location || null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    if (status !== undefined) {
      updateData.status = status;
      // Set postedAt when going live for the first time
      if (status === JobPostStatus.LIVE && !existing.postedAt) {
        updateData.postedAt = new Date();
      }
    }

    const post = await prisma.jobPost.update({
      where: { id: postId },
      data: updateData,
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error updating job post:', error);
    return NextResponse.json({ error: 'Failed to update job post' }, { status: 500 });
  }
}

// DELETE /api/jobs/[id]/posts/[postId] - Delete a job post
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId, postId } = await params;
    if (!(await canAccessJob(session.user.email, jobId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify post belongs to this job
    const existing = await prisma.jobPost.findFirst({
      where: { id: postId, jobId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    await prisma.jobPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job post:', error);
    return NextResponse.json({ error: 'Failed to delete job post' }, { status: 500 });
  }
}
