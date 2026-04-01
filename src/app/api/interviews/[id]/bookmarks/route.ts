import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const createBookmarkSchema = z.object({
  timestamp: z.number().min(0),
  label: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

/**
 * GET /api/interviews/[id]/bookmarks
 * Get all bookmarks for an interview recording
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
          bookmarks: {
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
            orderBy: { timestamp: 'asc' },
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

  return NextResponse.json(interview.recording.bookmarks);
}

/**
 * POST /api/interviews/[id]/bookmarks
 * Create a bookmark at a specific timestamp
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
  const validation = createBookmarkSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { timestamp, label, color } = validation.data;

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

  const bookmark = await prisma.interviewBookmark.create({
    data: {
      recordingId: interview.recording.id,
      authorId: user.id,
      timestamp,
      label,
      color,
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

  return NextResponse.json(bookmark, { status: 201 });
}
