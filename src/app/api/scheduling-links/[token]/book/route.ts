import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';
import { createZoomMeeting } from '@/lib/zoom';
import { hashToken } from '@/lib/tokens';
import { rateLimit } from '@/lib/security/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Rate limit booking attempts by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rl = await rateLimit(`schedule-book:${ip}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json();
  const { startTime, endTime } = body;
  const candidateEmail = body.candidateEmail;
  const candidateName = body.candidateName;

  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
  }

  const hashedToken = hashToken(token);
  const link = await prisma.schedulingLink.findUnique({
    where: { token: hashedToken },
    include: {
      application: {
        include: {
          candidate: true,
          job: true,
          stage: true
        }
      },
      stage: {
        include: {
          job: true
        }
      }
    }
  });
  
  if (!link || link.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Invalid or expired scheduling link' }, { status: 404 });
  }
  
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    await prisma.schedulingLink.update({
      where: { id: link.id },
      data: { status: 'EXPIRED' }
    });
    return NextResponse.json({ error: 'Scheduling link has expired' }, { status: 410 });
  }
  
  // Get candidate info from application
  const candidate = link.application.candidate;
  const attendeeEmail = candidateEmail || candidate.email;
  const displayName = candidateName || `${candidate.firstName} ${candidate.lastName}`;

  // Create calendar event for each interviewer
  const events = [];
  for (const interviewerId of link.interviewerIds) {
    try {
      const event = await createCalendarEvent(
        interviewerId,
        `Interview: ${link.stage.job.title} - ${displayName}`,
        `Interview for ${link.stage.job.title} with ${displayName}`,
        new Date(startTime),
        new Date(endTime),
        [attendeeEmail].filter(Boolean) as string[],
        {
          addGoogleMeet: true,
          sendUpdates: 'all',
        }
      );
      events.push(event);
    } catch (error) {
      console.error(`Failed to create calendar event for interviewer ${interviewerId}:`, error);
    }
  }
  
  // Create interview record
  const interview = await prisma.interview.create({
    data: {
      applicationId: link.applicationId,
      interviewerId: link.interviewerIds[0], // Primary interviewer
      scheduledAt: new Date(startTime),
      duration: link.duration,
      type: 'VIDEO_INTERVIEW',
      meetingLink: events[0]?.hangoutLink || null
    }
  });
  
  // Mark link as used after successful booking
  await prisma.schedulingLink.update({
    where: { id: link.id },
    data: { status: 'EXPIRED' }
  });
  
  return NextResponse.json({ success: true, interview, events });
}

