import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hashToken } from '@/lib/tokens';
import { updateCalendarEvent, deleteCalendarEvent, createCalendarEvent } from '@/lib/google-calendar';
import { updateZoomMeeting } from '@/lib/zoom';
import { sendBrandedEmail } from '@/lib/postmark';

interface RouteParams {
  params: { token: string };
}

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  rescheduledBy: z.enum(['invitee', 'host']),
});

function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/**
 * POST /api/meet/manage/[token]/reschedule
 * Reschedule a confirmed meeting to a new date/time
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const body = await request.json();
  const validation = rescheduleSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { date, time } = validation.data;

  const meeting = await prisma.scheduledMeeting.findUnique({
    where: { manageTokenHash: tokenHash },
    include: {
      meetingType: { select: { name: true, duration: true, googleMeetEnabled: true, zoomEnabled: true, locationDetails: true } },
      host: { select: { id: true, firstName: true, lastName: true, email: true, timezone: true } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  if (meeting.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Meeting is not confirmed' }, { status: 400 });
  }

  const meetingTypeName = meeting.meetingType.name;

  // Parse new date/time in host's timezone → UTC
  const hostTimezone = meeting.host.timezone || 'America/Chicago';
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const roughDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(hostTimezone, roughDate);
  const newScheduledAt = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMinutes * 60000);
  const meetingEnd = new Date(newScheduledAt.getTime() + meeting.meetingType.duration * 60000);

  // Double-booking check: ScheduledMeeting (exclude current)
  const existingMeeting = await prisma.scheduledMeeting.findFirst({
    where: {
      hostId: meeting.host.id,
      status: 'CONFIRMED',
      id: { not: meeting.id },
      scheduledAt: { gte: newScheduledAt, lt: meetingEnd },
    },
  });

  if (existingMeeting) {
    return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });
  }

  // Double-booking check: Interview table
  const existingInterview = await prisma.interview.findFirst({
    where: {
      interviewerId: meeting.host.id,
      scheduledAt: { gte: newScheduledAt, lt: meetingEnd },
    },
  });

  if (existingInterview) {
    return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });
  }

  const oldScheduledAt = meeting.scheduledAt;

  // Update the meeting
  await prisma.scheduledMeeting.update({
    where: { id: meeting.id },
    data: {
      scheduledAt: newScheduledAt,
      rescheduledAt: new Date(),
      rescheduledFrom: oldScheduledAt,
    },
  });

  // Update Google Calendar event
  if (meeting.googleEventId) {
    try {
      await updateCalendarEvent(meeting.host.id, meeting.googleEventId, {
        startTime: newScheduledAt,
        endTime: meetingEnd,
      });
    } catch {
      // If update fails, try delete + recreate
      try {
        await deleteCalendarEvent(meeting.host.id, meeting.googleEventId);
        const calendarLocation = meeting.meetingLink || meeting.meetingType.locationDetails || undefined;
        const calEvent = await createCalendarEvent(
          meeting.host.id,
          `${meeting.meetingType.name} - ${meeting.inviteeName}`,
          meeting.meetingLink
            ? `Join Zoom: ${meeting.meetingLink}\n\nMeeting rescheduled via manage link`
            : `Meeting rescheduled via manage link`,
          newScheduledAt,
          meetingEnd,
          [meeting.inviteeEmail, meeting.host.email],
          {
            location: calendarLocation,
            addGoogleMeet: !meeting.meetingLink && meeting.meetingType.googleMeetEnabled,
            sendUpdates: 'all',
          }
        );
        if (calEvent) {
          const eventData = calEvent as { id?: string; hangoutLink?: string };
          const updateData: { googleEventId?: string; meetingLink?: string } = {};
          if (eventData.id) updateData.googleEventId = eventData.id;
          if (eventData.hangoutLink) updateData.meetingLink = eventData.hangoutLink;
          if (Object.keys(updateData).length > 0) {
            await prisma.scheduledMeeting.update({
              where: { id: meeting.id },
              data: updateData,
            });
          }
        }
      } catch (err) {
        console.error('Failed to recreate calendar event:', err);
      }
    }
  }

  // Update Zoom meeting if exists
  if (meeting.zoomMeetingId) {
    try {
      await updateZoomMeeting(meeting.zoomMeetingId, {
        startTime: newScheduledAt,
        duration: meeting.meetingType.duration,
        timezone: hostTimezone,
      });
    } catch (err) {
      console.error('Failed to update Zoom meeting:', err);
    }
  }

  // Send reschedule email to BOTH parties (since either can use the manage link)
  const inviteeTz = meeting.inviteeTimezone || hostTimezone;

  function formatForTz(dt: Date, tz: string) {
    return {
      date: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz }),
      time: dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }),
    };
  }

  function buildRescheduleHtml(oldFmt: { date: string; time: string }, newFmt: { date: string; time: string }, tz: string) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f7fafc; border-radius: 8px;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0;"><strong>Meeting:</strong> ${meetingTypeName}</p>
          <p style="margin: 0 0 8px 0; text-decoration: line-through; color: #a0aec0;"><strong>Was:</strong> ${oldFmt.date} at ${oldFmt.time} (${tz})</p>
          <p style="margin: 0; color: #2d3748;"><strong>New time:</strong> ${newFmt.date} at ${newFmt.time} (${tz})</p>
        </td></tr>
      </table>
    `;
  }

  // Email the host
  const hostOldFmt = formatForTz(oldScheduledAt, hostTimezone);
  const hostNewFmt = formatForTz(newScheduledAt, hostTimezone);

  sendBrandedEmail({
    to: meeting.host.email,
    subject: `Meeting Rescheduled: ${meetingTypeName} with ${meeting.inviteeName}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Meeting Rescheduled</h2>
      <p>The following meeting with ${meeting.inviteeName} has been rescheduled.</p>
      ${buildRescheduleHtml(hostOldFmt, hostNewFmt, hostTimezone)}
    `,
    preheader: `Rescheduled to ${hostNewFmt.date} at ${hostNewFmt.time}`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send reschedule email to host:', err));

  // Email the invitee
  const inviteeOldFmt = formatForTz(oldScheduledAt, inviteeTz);
  const inviteeNewFmt = formatForTz(newScheduledAt, inviteeTz);

  sendBrandedEmail({
    to: meeting.inviteeEmail,
    subject: `Meeting Rescheduled: ${meetingTypeName} with ${meeting.host.firstName} ${meeting.host.lastName}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Meeting Rescheduled</h2>
      <p>Hi ${meeting.inviteeName},</p>
      <p>The following meeting with ${meeting.host.firstName} ${meeting.host.lastName} has been rescheduled.</p>
      ${buildRescheduleHtml(inviteeOldFmt, inviteeNewFmt, inviteeTz)}
    `,
    preheader: `Rescheduled to ${inviteeNewFmt.date} at ${inviteeNewFmt.time}`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send reschedule email to invitee:', err));

  return NextResponse.json({ success: true });
}
