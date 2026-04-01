import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const updateClipSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/interviews/[id]/clips/[clipId]
 * Get a specific clip
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, clipId } = await params;

  const clip = await prisma.interviewClip.findUnique({
    where: { id: clipId },
    include: {
      recording: {
        include: { interview: true },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!clip || clip.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  return NextResponse.json(clip);
}

/**
 * PATCH /api/interviews/[id]/clips/[clipId]
 * Update a clip
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, clipId } = await params;

  const body = await req.json();
  const validation = updateClipSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { title, isPublic, expiresAt } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const clip = await prisma.interviewClip.findUnique({
    where: { id: clipId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!clip || clip.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  // Only creator can update
  if (clip.createdById !== user.id) {
    return NextResponse.json(
      { error: 'Only the creator can update this clip' },
      { status: 403 }
    );
  }

  const updated = await prisma.interviewClip.update({
    where: { id: clipId },
    data: {
      ...(title && { title }),
      ...(isPublic !== undefined && { isPublic }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
    include: {
      createdBy: {
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
 * DELETE /api/interviews/[id]/clips/[clipId]
 * Delete a clip
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, clipId } = await params;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const clip = await prisma.interviewClip.findUnique({
    where: { id: clipId },
    include: {
      recording: {
        include: { interview: true },
      },
    },
  });

  if (!clip || clip.recording.interview.id !== id) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  // Only creator can delete
  if (clip.createdById !== user.id) {
    return NextResponse.json(
      { error: 'Only the creator can delete this clip' },
      { status: 403 }
    );
  }

  await prisma.interviewClip.delete({
    where: { id: clipId },
  });

  return NextResponse.json({ success: true });
}
