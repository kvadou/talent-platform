import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const createClipSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
}).refine(data => data.endTime > data.startTime, {
  message: 'End time must be after start time',
});

/**
 * GET /api/interviews/[id]/clips
 * Get all clips for an interview recording
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recording: {
        include: {
          clips: {
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
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.recording) {
    return NextResponse.json({ error: 'No recording found' }, { status: 404 });
  }

  return NextResponse.json(interview.recording.clips);
}

/**
 * POST /api/interviews/[id]/clips
 * Create a clip from a recording for internal team use
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json();
  const validation = createClipSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { title, startTime, endTime } = validation.data;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { recording: true },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.recording) {
    return NextResponse.json({ error: 'No recording found' }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Validate times against recording duration
  if (interview.recording.duration) {
    if (endTime > interview.recording.duration) {
      return NextResponse.json(
        { error: 'End time exceeds recording duration' },
        { status: 400 }
      );
    }
  }

  const clip = await prisma.interviewClip.create({
    data: {
      recordingId: interview.recording.id,
      createdById: user.id,
      title,
      startTime,
      endTime,
      shareToken: randomUUID(),
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

  return NextResponse.json(clip, { status: 201 });
}

/**
 * DELETE /api/interviews/[id]/clips
 * Delete a clip by clipId (passed as query param)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await params; // consume params to avoid Next.js warning

  const { searchParams } = new URL(req.url);
  const clipId = searchParams.get('clipId');

  if (!clipId) {
    return NextResponse.json({ error: 'clipId is required' }, { status: 400 });
  }

  const clip = await prisma.interviewClip.findUnique({
    where: { id: clipId },
  });

  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  await prisma.interviewClip.delete({
    where: { id: clipId },
  });

  return NextResponse.json({ success: true });
}
