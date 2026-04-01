import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/public/clips/[shareToken]
 * Public endpoint - no auth required
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  const clip = await prisma.interviewClip.findUnique({
    where: { shareToken },
    include: {
      recording: {
        select: {
          audioUrl: true,
          duration: true,
          interview: {
            select: {
              type: true,
              application: {
                select: {
                  candidate: {
                    select: { firstName: true, lastName: true },
                  },
                  job: {
                    select: { title: true },
                  },
                },
              },
            },
          },
        },
      },
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (!clip) {
    return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
  }

  return NextResponse.json({
    title: clip.title,
    startTime: clip.startTime,
    endTime: clip.endTime,
    duration: clip.endTime - clip.startTime,
    audioUrl: clip.recording.audioUrl,
    candidateName: `${clip.recording.interview.application.candidate.firstName} ${clip.recording.interview.application.candidate.lastName}`,
    jobTitle: clip.recording.interview.application.job.title,
    interviewType: clip.recording.interview.type,
    sharedBy: `${clip.createdBy.firstName} ${clip.createdBy.lastName}`,
    createdAt: clip.createdAt,
  });
}
