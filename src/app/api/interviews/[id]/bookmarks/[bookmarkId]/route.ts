import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const updateBookmarkSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

/**
 * PATCH /api/interviews/[id]/bookmarks/[bookmarkId]
 * Update a bookmark
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; bookmarkId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, bookmarkId } = await params;

  const body = await req.json();
  const validation = updateBookmarkSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { label, color } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const bookmark = await prisma.interviewBookmark.findUnique({
    where: { id: bookmarkId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!bookmark || bookmark.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }

  // Only author can update
  if (bookmark.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the author can update this bookmark' },
      { status: 403 }
    );
  }

  const updated = await prisma.interviewBookmark.update({
    where: { id: bookmarkId },
    data: {
      ...(label && { label }),
      ...(color !== undefined && { color }),
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
 * DELETE /api/interviews/[id]/bookmarks/[bookmarkId]
 * Delete a bookmark
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; bookmarkId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, bookmarkId } = await params;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const bookmark = await prisma.interviewBookmark.findUnique({
    where: { id: bookmarkId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!bookmark || bookmark.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }

  // Only author can delete
  if (bookmark.authorId !== user.id) {
    return NextResponse.json(
      { error: 'Only the author can delete this bookmark' },
      { status: 403 }
    );
  }

  await prisma.interviewBookmark.delete({
    where: { id: bookmarkId },
  });

  return NextResponse.json({ success: true });
}
