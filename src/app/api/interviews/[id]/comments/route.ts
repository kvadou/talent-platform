import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const createCommentSchema = z.object({
  timestamp: z.number().min(0),
  content: z.string().min(1),
  parentId: z.string().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).optional(),
  isResolved: z.boolean().optional(),
});

/**
 * GET /api/interviews/[id]/comments
 * Get all comments for an interview recording
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

  // Get the interview with recording
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      recording: {
        include: {
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              replies: {
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
                orderBy: { createdAt: 'asc' },
              },
            },
            where: { parentId: null }, // Only top-level comments
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

  return NextResponse.json(interview.recording.comments);
}

/**
 * POST /api/interviews/[id]/comments
 * Add a timestamped comment to an interview recording
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

  // Parse and validate request body
  const body = await req.json();
  const validation = createCommentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { timestamp, content, parentId } = validation.data;

  // Get the interview with recording
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

  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // If this is a reply, verify parent exists
  if (parentId) {
    const parent = await prisma.interviewComment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.recordingId !== interview.recording.id) {
      return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
    }
  }

  // Create the comment
  const comment = await prisma.interviewComment.create({
    data: {
      recordingId: interview.recording.id,
      authorId: user.id,
      timestamp,
      content,
      parentId,
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

  return NextResponse.json(comment, { status: 201 });
}
