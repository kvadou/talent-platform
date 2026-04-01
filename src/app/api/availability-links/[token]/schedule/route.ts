import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { createCalendarEvent } from '@/lib/google-calendar';
import { createZoomMeeting } from '@/lib/zoom';

// POST - Schedule interview from candidate availability
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { token } = await params;
  const body = await req.json();
  const { startTime, endTime, interviewerId } = body;

  if (!startTime || !endTime) {
    return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
  }

  const link = await prisma.availabilityLink.findUnique({
    where: { token },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true } }
        }
      },
      stage: { select: { name: true, id: true } },
      availabilities: true
    }
  });

  if (!link) {
    return NextResponse.json({ error: 'Availability link not found' }, { status: 404 });
  }

  if (link.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Cannot schedule: availability not yet submitted or already scheduled' }, { status: 400 });
  }

  // Verify the selected time falls within one of the candidate's availability windows
  const selectedStart = new Date(startTime);
  const selectedEnd = new Date(endTime);

  const isValidTime = link.availabilities.some(a => {
    const availStart = new Date(a.startTime);
    const availEnd = new Date(a.endTime);
    return selectedStart >= availStart && selectedEnd <= availEnd;
  });

  if (!isValidTime) {
    return NextResponse.json({
      error: 'Selected time does not fall within candidate\'s availability'
    }, { status: 400 });
  }

  const candidate = link.application.candidate;
  const displayName = `${candidate.firstName} ${candidate.lastName}`;

  // Determine interviewer
  const schedulingInterviewerId = interviewerId || link.interviewerIds[0] || dbUser.id;

  // Create calendar event
  let calendarEvent = null;
  try {
    calendarEvent = await createCalendarEvent(
      schedulingInterviewerId,
      `Interview: ${link.application.job.title} - ${displayName}`,
      `Interview for ${link.application.job.title} with ${displayName}`,
      selectedStart,
      selectedEnd,
      [candidate.email].filter(Boolean) as string[],
      {
        addGoogleMeet: true,
        sendUpdates: 'all',
      }
    );
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    // Continue without calendar event
  }

  // Create interview record
  const interview = await prisma.interview.create({
    data: {
      applicationId: link.applicationId,
      interviewerId: schedulingInterviewerId,
      scheduledAt: selectedStart,
      duration: link.duration,
      type: 'VIDEO_INTERVIEW',
      meetingLink: calendarEvent?.hangoutLink || null,
      googleEventId: calendarEvent?.id || null
    }
  });

  // Update availability link status
  await prisma.availabilityLink.update({
    where: { id: link.id },
    data: {
      status: 'SCHEDULED',
      scheduledAt: new Date()
    }
  });

  return NextResponse.json({
    success: true,
    interview,
    calendarEvent
  });
}
