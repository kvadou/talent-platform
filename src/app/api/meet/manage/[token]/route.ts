import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

interface RouteParams {
  params: { token: string };
}

/**
 * GET /api/meet/manage/[token]
 * Look up a scheduled meeting by its management token
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const meeting = await prisma.scheduledMeeting.findUnique({
    where: { manageTokenHash: tokenHash },
    include: {
      meetingType: {
        select: { name: true, duration: true, locationType: true, locationDetails: true },
      },
      host: {
        select: { firstName: true, lastName: true, email: true, timezone: true, schedulingUsername: true },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: meeting.id,
    meetingTypeName: meeting.meetingType.name,
    locationType: meeting.meetingType.locationType,
    locationDetails: meeting.meetingType.locationDetails,
    hostName: `${meeting.host.firstName} ${meeting.host.lastName}`,
    hostTimezone: meeting.host.timezone || 'America/Chicago',
    hostUsername: meeting.host.schedulingUsername,
    inviteeName: meeting.inviteeName,
    inviteeEmail: meeting.inviteeEmail,
    inviteeTimezone: meeting.inviteeTimezone,
    scheduledAt: meeting.scheduledAt.toISOString(),
    duration: meeting.duration,
    timezone: meeting.timezone,
    meetingLink: meeting.meetingLink,
    location: meeting.location,
    status: meeting.status,
    cancelledAt: meeting.cancelledAt?.toISOString() || null,
    cancelReason: meeting.cancelReason,
    rescheduledAt: meeting.rescheduledAt?.toISOString() || null,
    rescheduledFrom: meeting.rescheduledFrom?.toISOString() || null,
  });
}
