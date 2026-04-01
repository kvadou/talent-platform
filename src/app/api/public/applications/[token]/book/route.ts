import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InterviewType } from '@prisma/client';
import { sendEmail, sendBrandedEmail } from '@/lib/postmark';
import { interviewConfirmationTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { createCalendarEvent } from '@/lib/google-calendar';
import { createZoomMeeting } from '@/lib/zoom';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

// POST - Book an interview slot
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(req);
    const limitResult = await rateLimit(`portal-book:${ip}`, 20, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const body = await req.json();
    const { startTime, endTime, recruiterId: bodyRecruiterId } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    // Get the application — try hashed lookup first, fall back for pre-migration tokens
    const bookInclude = {
      application: {
        include: {
          candidate: true,
          job: {
            include: {
              market: {
                include: {
                  organization: true,
                },
              },
            },
          },
          stage: true,
          schedulingLinks: {
            where: {
              status: 'ACTIVE' as const,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
              ],
            },
            include: {
              meetingType: true,
            },
            orderBy: { createdAt: 'desc' as const },
            take: 1,
          },
        },
      },
    };

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token: tokenHash },
      include: bookInclude,
    });

    if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const application = tokenRecord.application;
    const organizationId = application.job.market.organizationId;

    // Determine recruiter (same logic as slots API)
    let recruiterId: string | null = bodyRecruiterId || null;
    const schedulingLink = application.schedulingLinks[0];

    if (!recruiterId) {
      if (schedulingLink && schedulingLink.interviewerIds.length > 0) {
        recruiterId = schedulingLink.interviewerIds[0];
      } else {
        const recruiterWithAvailability = await prisma.user.findFirst({
          where: {
            organizationId,
            recruiterAvailability: {
              some: {
                isEnabled: true,
              },
            },
          },
          select: { id: true },
        });

        if (recruiterWithAvailability) {
          recruiterId = recruiterWithAvailability.id;
        } else {
          const admin = await prisma.user.findFirst({
            where: {
              organizationId,
              role: { in: ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER'] },
            },
            select: { id: true },
          });

          if (admin) {
            recruiterId = admin.id;
          }
        }
      }
    }

    if (!recruiterId) {
      return NextResponse.json(
        { error: 'No available recruiter found' },
        { status: 400 }
      );
    }

    // Verify the slot is still available
    const scheduledAt = new Date(startTime);
    const scheduledEnd = new Date(endTime);
    const duration = Math.round((scheduledEnd.getTime() - scheduledAt.getTime()) / 60000);

    // Check for conflicts - find any interview that overlaps with this slot
    const existingInterview = await prisma.interview.findFirst({
      where: {
        interviewerId: recruiterId,
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - duration * 60 * 1000),
          lte: scheduledEnd,
        },
      },
    });

    if (existingInterview) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please select another time.' },
        { status: 409 }
      );
    }

    // Get meeting type for configuration
    let meetingType = schedulingLink?.meetingType;

    if (!meetingType) {
      meetingType = await prisma.meetingType.findFirst({
        where: {
          userId: recruiterId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // Determine interview type and location
    // Use the stage's configured defaultInterviewType if set, otherwise fall back to meeting type config
    const stageInterviewType = application.stage?.defaultInterviewType as InterviewType | null;
    const isPhoneScreenStage = stageInterviewType === 'PHONE_SCREEN';

    let interviewType: InterviewType = 'PHONE_SCREEN';
    let meetingLink: string | null = null;
    let location: string | null = null;

    if (stageInterviewType) {
      // Use the stage's configured interview type
      interviewType = stageInterviewType;
      if (stageInterviewType === 'ONSITE' && meetingType?.locationDetails) {
        location = meetingType.locationDetails;
      }
    } else if (meetingType) {
      switch (meetingType.locationType) {
        case 'GOOGLE_MEET':
          interviewType = 'VIDEO_INTERVIEW';
          meetingLink = meetingType.googleMeetEnabled ? null : null; // Will be generated via Google Calendar
          break;
        case 'ZOOM':
          interviewType = 'VIDEO_INTERVIEW';
          meetingLink = meetingType.zoomLink;
          break;
        case 'IN_PERSON':
          interviewType = 'ONSITE';
          location = meetingType.locationDetails;
          break;
        case 'PHONE':
        default:
          interviewType = 'PHONE_SCREEN';
          break;
      }
    }

    // Get the recruiter's full info for calendar/email
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      select: { id: true, firstName: true, lastName: true, email: true, timezone: true },
    });

    // Pre-create Zoom meeting if needed (need the link before creating interview record)
    let zoomMeetingId: string | null = null;
    let generatedMeetingLink: string | null = meetingLink;

    if (recruiter && !isPhoneScreenStage && meetingType?.locationType === 'ZOOM') {
      try {
        const zoomMeeting = await createZoomMeeting({
          topic: `Interview: ${application.candidate.firstName} ${application.candidate.lastName} - ${application.job.title}`,
          startTime: scheduledAt,
          duration,
          hostEmail: recruiter.email,
          settings: {
            hostVideo: true,
            participantVideo: true,
            joinBeforeHost: false,
            waitingRoom: true,
          },
        });

        zoomMeetingId = zoomMeeting.id;
        generatedMeetingLink = zoomMeeting.join_url;
      } catch (zoomError) {
        console.error('Failed to create Zoom meeting:', zoomError);
        if (meetingType.zoomLink) {
          generatedMeetingLink = meetingType.zoomLink;
        }
      }
    }

    // Create interview record first, then calendar events (need interview ID for kit URL)
    const slotLockKey = `${recruiterId}:${scheduledAt.toISOString().slice(0, 16)}`;
    const interview = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${slotLockKey}))`;

      const recheck = await tx.interview.findFirst({
        where: {
          interviewerId: recruiterId,
          scheduledAt: {
            gte: new Date(scheduledAt.getTime() - duration * 60 * 1000),
            lte: scheduledEnd,
          },
        },
        select: { id: true },
      });

      if (recheck) {
        throw new Error('SLOT_CONFLICT');
      }

      return tx.interview.create({
        data: {
          applicationId: application.id,
          interviewerId: recruiterId,
          scheduledAt,
          duration,
          type: interviewType,
          location,
          meetingLink: generatedMeetingLink,
          zoomMeetingId,
        },
        include: {
          interviewer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });
    });

    // Build URLs for calendar descriptions
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
    const interviewKitUrl = `${baseUrl}/interviews/${interview.id}`;
    const candidatePortalUrl = `${baseUrl}/status/${token}`;
    const candidatePhone = application.candidate.phone || 'Not provided';

    // Create Google Calendar event for RECRUITER only (candidate gets email + portal)
    let googleEventId: string | null = null;

    if (recruiter && !isPhoneScreenStage && meetingType?.locationType === 'GOOGLE_MEET') {
      try {
        const calendarDescription = [
          `Interview ${application.candidate.firstName} ${application.candidate.lastName} for the ${application.job.title} position.`,
          ``,
          `Interview type: Video Interview`,
          ``,
          `📋 Interview Kit:`,
          interviewKitUrl,
          ``,
          `---`,
          `Candidate: ${application.candidate.firstName} ${application.candidate.lastName}`,
          `Phone: ${candidatePhone}`,
          `Email: ${application.candidate.email}`,
          `Candidate Portal: ${candidatePortalUrl}`,
        ].join('\n');

        const calendarEvent = await createCalendarEvent(
          recruiterId,
          `Interview: ${application.candidate.firstName} ${application.candidate.lastName} - ${application.job.title}`,
          calendarDescription,
          scheduledAt,
          scheduledEnd,
          [recruiter.email],
          {
            addGoogleMeet: true,
            sendUpdates: 'none',
          }
        );

        googleEventId = calendarEvent.id || null;
        if (calendarEvent.conferenceData?.entryPoints) {
          const videoEntry = calendarEvent.conferenceData.entryPoints.find(
            (ep: any) => ep.entryPointType === 'video'
          );
          if (videoEntry?.uri) {
            generatedMeetingLink = videoEntry.uri;
            // Update interview with the Meet link
            await prisma.interview.update({
              where: { id: interview.id },
              data: { meetingLink: generatedMeetingLink },
            });
          }
        }
      } catch (calendarError) {
        console.error('Failed to create calendar event:', calendarError);
      }
    }

    // Create calendar event for phone screen — RECRUITER only
    if (recruiter && isPhoneScreenStage) {
      try {
        const stcPhone = '(332) 345-4168';
        const calendarDescription = [
          `Phone Screen ${application.candidate.firstName} ${application.candidate.lastName} for the ${application.job.title} position.`,
          ``,
          `Call candidate at ${candidatePhone} from ${stcPhone}.`,
          ``,
          `📋 Interview Kit:`,
          interviewKitUrl,
          ``,
          `---`,
          `Candidate: ${application.candidate.firstName} ${application.candidate.lastName}`,
          `Phone: ${candidatePhone}`,
          `Email: ${application.candidate.email}`,
          `Candidate Portal: ${candidatePortalUrl}`,
        ].join('\n');

        const calendarEvent = await createCalendarEvent(
          recruiterId,
          `Phone Screen: ${application.candidate.firstName} ${application.candidate.lastName} - ${application.job.title}`,
          calendarDescription,
          scheduledAt,
          scheduledEnd,
          [recruiter.email],
          {
            addGoogleMeet: false,
            sendUpdates: 'none',
          }
        );
        googleEventId = calendarEvent.id || null;
      } catch (calendarError) {
        console.error('Failed to create calendar event for phone screen:', calendarError);
      }
    }

    // Update interview with calendar event ID if created
    if (googleEventId) {
      await prisma.interview.update({
        where: { id: interview.id },
        data: { googleEventId },
      });
    }

    // Send confirmation email to candidate
    const interviewerName = interview.interviewer
      ? `${interview.interviewer.firstName} ${interview.interviewer.lastName}`
      : undefined;

    try {
      const typeLabel = interviewType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
      const candidateTimezone = application.candidate.timezone || 'America/New_York';
      const formattedInterviewDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        timeZone: candidateTimezone,
      }).format(scheduledAt);
      const formattedInterviewTime = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        timeZone: candidateTimezone,
      }).format(scheduledAt);

      const mergeData = buildMergeData({
        candidate: { firstName: application.candidate.firstName, lastName: application.candidate.lastName, email: application.candidate.email },
        job: { title: application.job.title },
        interview: {
          type: typeLabel,
          date: formattedInterviewDate,
          time: formattedInterviewTime,
          duration,
          location: location || undefined,
          meetingLink: generatedMeetingLink || undefined,
          interviewerName,
        },
      });
      const dbTemplate = await resolveTemplate('INTERVIEW_CONFIRMATION', mergeData);
      const emailTemplate = dbTemplate || interviewConfirmationTemplate(
        application.candidate.firstName,
        typeLabel,
        scheduledAt.toISOString(),
        duration,
        location || undefined,
        generatedMeetingLink || undefined,
        interviewerName,
        candidateTimezone
      );

      const sendResult = await sendBrandedEmail({
        to: application.candidate.email,
        subject: emailTemplate.subject,
        htmlBody: emailTemplate.html,
        from: 'RECRUITING',
      });

      // Log the email
      await prisma.messageLog.create({
        data: {
          applicationId: application.id,
          type: 'EMAIL',
          recipient: application.candidate.email,
          subject: emailTemplate.subject,
          body: emailTemplate.html,
          status: 'SENT',
          postmarkMessageId: sendResult?.MessageID || null,
        },
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Continue - interview is booked even if email fails
    }

    // Send notification email to recruiter with interview kit link
    if (recruiter?.email) {
      try {
        const typeLabel = interviewType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());

        const recruiterTimezone = recruiter.timezone || 'America/New_York';
        const formattedDate = new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
          timeZone: recruiterTimezone,
        }).format(scheduledAt);

        const recruiterSubject = `Interview Scheduled: ${application.candidate.firstName} ${application.candidate.lastName} — ${typeLabel}`;
        const recruiterBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a2e; margin-bottom: 4px;">New Interview Scheduled</h2>
            <p style="color: #666; margin-top: 0;">A candidate has booked an interview with you.</p>
            <div style="background: #f8f9fa; border-left: 4px solid #6A469D; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Candidate:</strong> ${application.candidate.firstName} ${application.candidate.lastName}</p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${application.candidate.email}</p>
              <p style="margin: 4px 0;"><strong>Phone:</strong> ${candidatePhone}</p>
              <p style="margin: 4px 0;"><strong>Position:</strong> ${application.job.title}</p>
              <p style="margin: 4px 0;"><strong>Type:</strong> ${typeLabel}</p>
              <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
              <p style="margin: 4px 0;"><strong>Duration:</strong> ${duration} minutes</p>
            </div>
            <a href="${interviewKitUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6A469D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px;">
              Open Interview Kit
            </a>
          </div>
        `;

        await sendEmail({
          to: recruiter.email,
          subject: recruiterSubject,
          htmlBody: recruiterBody,
          from: 'RECRUITING',
        });
      } catch (recruiterEmailError) {
        console.error('Failed to send recruiter notification:', recruiterEmailError);
      }
    }

    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        duration: interview.duration,
        type: interview.type,
        location: interview.location,
        meetingLink: interview.meetingLink,
        interviewer: interview.interviewer,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SLOT_CONFLICT') {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please select another time.' },
        { status: 409 }
      );
    }
    console.error('Failed to book interview:', error);
    return NextResponse.json(
      { error: 'Failed to book interview. Please try again.' },
      { status: 500 }
    );
  }
}
