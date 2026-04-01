import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const updateCommentSchema = z.object({
  content: z.string().min(1).optional(),
  isResolved: z.boolean().optional(),
});

/**
 * PATCH /api/interviews/[id]/comments/[commentId]
 * Update a comment (content or resolved status)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, commentId } = await params;

  // Parse and validate request body
  const body = await req.json();
  const validation = updateCommentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { content, isResolved } = validation.data;

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get the comment
  const comment = await prisma.interviewComment.findUnique({
    where: { id: commentId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!comment || comment.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Only the author can edit content, but anyone can resolve
  if (content && comment.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the author can edit this comment' },
      { status: 403 }
    );
  }

  // Update the comment
  const updated = await prisma.interviewComment.update({
    where: { id: commentId },
    data: {
      ...(content && { content }),
      ...(isResolved !== undefined && { isResolved }),
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/interviews/[id]/comments/[commentId]
 * Delete a comment (author only)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, commentId } = await params;

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get the comment
  const comment = await prisma.interviewComment.findUnique({
    where: { id: commentId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!comment || comment.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Only the author can delete
  if (comment.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the author can delete this comment' },
      { status: 403 }
    );
  }

  // Delete the comment (cascade will handle replies)
  await prisma.interviewComment.delete({
    where: { id: commentId },
  });

  return NextResponse.json({ success: true });
}
