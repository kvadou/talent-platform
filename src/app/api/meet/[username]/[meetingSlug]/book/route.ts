import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createCalendarEvent } from '@/lib/google-calendar';
import { createZoomMeeting, getZoomUserByEmail } from '@/lib/zoom';
import { sendBrandedEmail } from '@/lib/postmark';
import { generateToken, hashToken } from '@/lib/tokens';

interface RouteParams {
  params: {
    username: string;
    meetingSlug: string;
  };
}

const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  notes: z.string().optional(),
  inviteeTimezone: z.string().optional(),
});

/**
 * Get the UTC offset in minutes for a given timezone on a given date.
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/**
 * POST /api/meet/[username]/[meetingSlug]/book
 * Book a meeting slot — creates a ScheduledMeeting (no Application required)
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { username, meetingSlug } = await params;

  // Validate request body
  const body = await request.json();
  const validation = bookingSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { date, time, name, email, notes, inviteeTimezone } = validation.data;

  // Find user by scheduling username
  const user = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: { id: true, organizationId: true, email: true, firstName: true, lastName: true, timezone: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const timezone = user.timezone || 'America/Chicago';

  // Find meeting type
  const meetingType = await prisma.meetingType.findFirst({
    where: {
      userId: user.id,
      slug: meetingSlug,
      isActive: true,
    },
  });

  if (!meetingType) {
    return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
  }
  const meetingTypeName = meetingType.name;
  const meetingTypeDuration = meetingType.duration;

  // Parse the selected time in the recruiter's timezone and convert to UTC
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const roughDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, roughDate);
  const scheduledAt = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMinutes * 60000);

  const meetingEnd = new Date(scheduledAt.getTime() + meetingType.duration * 60000);

  // Double-booking check: ScheduledMeeting table
  const existingMeeting = await prisma.scheduledMeeting.findFirst({
    where: {
      hostId: user.id,
      status: 'CONFIRMED',
      scheduledAt: {
        gte: scheduledAt,
        lt: meetingEnd,
      },
    },
  });

  if (existingMeeting) {
    return NextResponse.json(
      { error: 'This time slot is no longer available' },
      { status: 409 }
    );
  }

  // Double-booking check: Interview table (recruiter might have ATS interviews)
  const existingInterview = await prisma.interview.findFirst({
    where: {
      interviewerId: user.id,
      scheduledAt: {
        gte: scheduledAt,
        lt: meetingEnd,
      },
    },
  });

  if (existingInterview) {
    return NextResponse.json(
      { error: 'This time slot is no longer available' },
      { status: 409 }
    );
  }

  // Generate management token
  const rawManageToken = generateToken();
  const manageTokenHash = hashToken(rawManageToken);

  // Create the ScheduledMeeting
  const meeting = await prisma.scheduledMeeting.create({
    data: {
      meetingTypeId: meetingType.id,
      hostId: user.id,
      organizationId: user.organizationId,
      inviteeName: name,
      inviteeEmail: email,
      inviteeTimezone: inviteeTimezone || null,
      notes: notes || null,
      scheduledAt,
      duration: meetingType.duration,
      timezone,
      location: meetingType.locationDetails,
      manageTokenHash,
    },
  });

  // Create Zoom meeting if enabled
  let meetingLink: string | undefined;
  let zoomMeetingId: string | undefined;

  if (meetingType.zoomEnabled || meetingType.locationType === 'ZOOM') {
    if (meetingType.zoomLink) {
      // Use personal Zoom link
      meetingLink = meetingType.zoomLink;
    } else {
      // Create a new Zoom meeting via API
      // Resolve the host's Zoom email — may differ from their DB email
      let zoomHostEmail: string | undefined = user.email;
      const zoomUser = await getZoomUserByEmail(user.email);
      if (!zoomUser) {
        // Try alternate domain (e.g. acmetalent.com → chessat3.com)
        const [localPart] = user.email.split('@');
        const altDomains = ['chessat3.com', 'acmetalent.com'];
        for (const domain of altDomains) {
          const altEmail = `${localPart}@${domain}`;
          if (altEmail === user.email) continue;
          const altUser = await getZoomUserByEmail(altEmail);
          if (altUser) {
            zoomHostEmail = altEmail;
            break;
          }
        }
        if (!zoomUser && zoomHostEmail === user.email) {
          zoomHostEmail = undefined; // No matching Zoom user found, omit hostEmail
        }
      }

      try {
        const zoomMeeting = await createZoomMeeting({
          topic: `${meetingType.name} - ${name}`,
          startTime: scheduledAt,
          duration: meetingType.duration,
          timezone,
          hostEmail: zoomHostEmail,
          settings: {
            hostVideo: true,
            participantVideo: true,
            joinBeforeHost: true,
            muteUponEntry: false,
            waitingRoom: false,
          },
        });
        meetingLink = zoomMeeting.join_url;
        zoomMeetingId = String(zoomMeeting.id);
      } catch (err) {
        console.error('Failed to create Zoom meeting:', err);
      }
    }

    // Store Zoom link and meeting ID
    if (meetingLink || zoomMeetingId) {
      const zoomUpdate: { meetingLink?: string; zoomMeetingId?: string } = {};
      if (meetingLink) zoomUpdate.meetingLink = meetingLink;
      if (zoomMeetingId) zoomUpdate.zoomMeetingId = zoomMeetingId;
      await prisma.scheduledMeeting.update({
        where: { id: meeting.id },
        data: zoomUpdate,
      });
    }
  }

  // Optionally create Google Calendar event
  try {
    const calendarLocation = meetingLink || meetingType.locationDetails || undefined;
    const calEvent = await createCalendarEvent(
      user.id,
      `${meetingType.name} - ${name}`,
      meetingLink
        ? `Join Zoom: ${meetingLink}\n\n${notes || `Meeting booked via scheduling link by ${name} (${email})`}`
        : notes || `Meeting booked via scheduling link by ${name} (${email})`,
      scheduledAt,
      meetingEnd,
      [email, user.email],
      {
        location: calendarLocation,
        addGoogleMeet: !meetingLink && meetingType.googleMeetEnabled,
        sendUpdates: 'all',
      }
    );

    if (calEvent) {
      const eventData = calEvent as { id?: string; hangoutLink?: string };
      const updateData: { googleEventId?: string; meetingLink?: string } = {};
      if (eventData.id) {
        updateData.googleEventId = eventData.id;
      }
      // Only use hangoutLink if we don't already have a Zoom link
      if (eventData.hangoutLink && !meetingLink) {
        updateData.meetingLink = eventData.hangoutLink;
        meetingLink = eventData.hangoutLink;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.scheduledMeeting.update({
          where: { id: meeting.id },
          data: updateData,
        });
      }
    }
  } catch {
    // Google Calendar not connected — continue without it
  }

  // Send confirmation emails (fire-and-forget, don't block the response)
  const manageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/meet/manage/${rawManageToken}`;

  // Format times in host timezone (for host email)
  const formattedDateHost = scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  const formattedTimeHost = scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  // Format times in invitee timezone (for invitee email)
  const inviteeTz = inviteeTimezone || timezone;
  const formattedDateInvitee = scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: inviteeTz,
  });
  const formattedTimeInvitee = scheduledAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: inviteeTz,
  });

  function buildMeetingDetailsHtml(fDate: string, fTime: string, tz: string) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; background-color: #f7fafc; border-radius: 8px; padding: 20px;">
        <tr><td style="padding: 16px 20px;">
          <p style="margin: 0 0 8px 0;"><strong>Meeting:</strong> ${meetingTypeName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${fDate}</p>
          <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${fTime} (${tz})</p>
          <p style="margin: 0 0 8px 0;"><strong>Duration:</strong> ${meetingTypeDuration} minutes</p>
          ${meetingLink ? `<p style="margin: 0 0 8px 0;"><strong>Join:</strong> <a href="${meetingLink}" style="color: #6b46c1;">${meetingLink}</a></p>` : ''}
          ${notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${notes}</p>` : ''}
        </td></tr>
      </table>
    `;
  }

  const manageButton = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr><td style="text-align: center;">
        <a href="${manageUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6b46c1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          Reschedule or Cancel
        </a>
      </td></tr>
    </table>
  `;

  // Email to invitee (times in invitee timezone)
  sendBrandedEmail({
    to: email,
    subject: `Meeting Confirmed: ${meetingTypeName} with ${user.firstName} ${user.lastName}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Your meeting is confirmed!</h2>
      <p>Hi ${name},</p>
      <p>Your meeting with ${user.firstName} ${user.lastName} has been scheduled.</p>
      ${buildMeetingDetailsHtml(formattedDateInvitee, formattedTimeInvitee, inviteeTz)}
      ${manageButton}
      <p style="font-size: 12px; color: #718096; text-align: center;">Need to make changes? Use the button above to reschedule or cancel.</p>
    `,
    preheader: `${formattedDateInvitee} at ${formattedTimeInvitee}`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send invitee confirmation:', err));

  // Email to host (times in host timezone)
  sendBrandedEmail({
    to: user.email,
    subject: `New Meeting Booked: ${meetingTypeName} with ${name}`,
    htmlBody: `
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">New meeting booked</h2>
      <p>${name} (<a href="mailto:${email}" style="color: #6b46c1;">${email}</a>) booked a meeting with you.</p>
      ${buildMeetingDetailsHtml(formattedDateHost, formattedTimeHost, timezone)}
      ${manageButton}
      <p style="font-size: 12px; color: #718096; text-align: center;">Need to make changes? Use the button above to manage this meeting.</p>
    `,
    preheader: `${name} booked ${meetingTypeName} for ${formattedDateHost} at ${formattedTimeHost}`,
    from: 'RECRUITING',
  }).catch((err) => console.error('Failed to send host confirmation:', err));

  return NextResponse.json({
    success: true,
    meetingId: meeting.id,
    scheduledAt: meeting.scheduledAt,
    meetingLink,
    manageToken: rawManageToken,
  });
}
