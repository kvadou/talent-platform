import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hashToken } from '@/lib/tokens';
import { deleteCalendarEvent } from '@/lib/google-calendar';
import { deleteZoomMeeting } from '@/lib/zoom';
import { sendBrandedEmail } from '@/lib/postmark';

interface RouteParams {
  params: { token: string };
}

const cancelSchema = z.object({
  reason: z.string().optional(),
  cancelledBy: z.enum(['invitee', 'host']),
});

/**
 * POST /api/meet/manage/[token]/cancel
 * Cancel a confirmed meeting and notify the other party
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const body = await request.json();
  const validation = cancelSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { reason } = validation.data;

  const meeting = await prisma.scheduledMeeting.findUnique({
    where: { manageTokenHash: tokenHash },
    include: {
      meetingType: { select: { name: true } },
      host: { select: { id: true, firstName: true, lastName: true, email: true, timezone: true } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  if (meeting.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Meeting is not confirmed' }, { status: 400 });
  }

  if (meeting.scheduledAt < new Date()) {
    return NextResponse.json({ error: 'Cannot cancel a past meeting' }, { status: 400 });
  }

  const meetingTypeName = meeting.meetingType.name;

  // Update meeting status
  await prisma.scheduledMeeting.update({
    where: { id: meeting.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: reason || null,
    },
  });

  // Delete Google Calendar event if exists
  if (meeting.googleEventId) {
    try {
      await deleteCalendarEvent(meeting.host.id, meeting.googleEventId);
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
    }
  }

  // Delete Zoom meeting if exists
  if (meeting.zoomMeetingId) {
    try {
      await deleteZoomMeeting(meeting.zoomMeetingId);
    } catch (err) {
      console.error('Failed to delete Zoom meeting:', err);
    }
  }

  // Send cancellation email to BOTH parties (since either can use the manage link)
  const hostTz = meeting.host.timezone || 'America/Chicago';
  const inviteeTz = meeting.inviteeTimezone || hostTz;

  const hostFormattedDate = meeting.scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: hostTz,
  });
  const hostFormattedTime = meeting.scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: hostTz,
  });

  const inviteeFormattedDate = meeting.scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: inviteeTz,
  });
  const inviteeFormattedTime = meeting.scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: inviteeTz,
  });

  function buildCancelHtml(fDate: string, fTime: string, tz: string) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #fef2f2; border-radius: 8px;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0;"><strong>Meeting:</strong> ${meetingTypeName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Was scheduled for:</strong> ${fDate} at ${fTime} (${tz})</p>
          ${reason ? `<p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </td></tr>
      </table>
    `;
  }

  // Email the host
  sendBrandedEmail({
    to: meeting.host.email,
    subject: `Meeting Cancelled: ${meetingTypeName} with ${meeting.inviteeName}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Meeting Cancelled</h2>
      <p>The following meeting with ${meeting.inviteeName} has been cancelled.</p>
      ${buildCancelHtml(hostFormattedDate, hostFormattedTime, hostTz)}
    `,
    preheader: `${meetingTypeName} with ${meeting.inviteeName} has been cancelled`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send cancellation email to host:', err));

  // Email the invitee
  sendBrandedEmail({
    to: meeting.inviteeEmail,
    subject: `Meeting Cancelled: ${meetingTypeName} with ${meeting.host.firstName} ${meeting.host.lastName}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Meeting Cancelled</h2>
      <p>Hi ${meeting.inviteeName},</p>
      <p>The following meeting with ${meeting.host.firstName} ${meeting.host.lastName} has been cancelled.</p>
      ${buildCancelHtml(inviteeFormattedDate, inviteeFormattedTime, inviteeTz)}
    `,
    preheader: `${meetingTypeName} with ${meeting.host.firstName} has been cancelled`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send cancellation email to invitee:', err));

  return NextResponse.json({ success: true });
}
