import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeTalkTime } from '@/lib/talk-time';
import { TranscriptSegment } from '@/lib/whisper';

export async function GET(
  _: Request,
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
        include: { transcript: true },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  if (!interview.recording) {
    return NextResponse.json({ error: 'No recording for this interview' }, { status: 404 });
  }

  if (!interview.recording.transcript) {
    return NextResponse.json({ error: 'No transcript for this recording' }, { status: 404 });
  }

  const segments = interview.recording.transcript.segments as unknown as TranscriptSegment[];

  if (!Array.isArray(segments)) {
    return NextResponse.json({ error: 'Invalid transcript segments' }, { status: 500 });
  }

  const stats = computeTalkTime(segments);

  return NextResponse.json(stats);
}
