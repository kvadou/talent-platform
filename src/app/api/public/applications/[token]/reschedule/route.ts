import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { interviewConfirmationTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { updateCalendarEvent, deleteCalendarEvent, createCalendarEvent } from '@/lib/google-calendar';
import { updateZoomMeeting } from '@/lib/zoom';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

// POST - Reschedule an interview
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(req);
    const limitResult = await rateLimit(`portal-reschedule:${ip}`, 20, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const body = await req.json();
    const { interviewId, startTime, endTime } = body;

    if (!interviewId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'interviewId, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    // Validate the token and get the application — try hashed lookup first
    const rescheduleInclude = {
      application: {
        include: {
          candidate: true,
          job: true,
          interviews: {
            where: { id: interviewId },
            include: {
              interviewer: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      },
    };

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token: tokenHash },
      include: rescheduleInclude,
    });

    if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const application = tokenRecord.application;
    const interview = application.interviews[0];

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const scheduledAt = new Date(startTime);
    const scheduledEnd = new Date(endTime);
    const duration = Math.round((scheduledEnd.getTime() - scheduledAt.getTime()) / 60000);

    // Check for conflicts with other interviews (excluding the current one)
    const existingInterview = await prisma.interview.findFirst({
      where: {
        interviewerId: interview.interviewerId,
        id: { not: interviewId },
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

    // Update Google Calendar event if it exists
    if (interview.googleEventId && interview.interviewer) {
      try {
        await updateCalendarEvent(interview.interviewerId, interview.googleEventId, {
          startTime: scheduledAt,
          endTime: scheduledEnd,
        });
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError);
        // Try to delete old and create new if update fails
        try {
          await deleteCalendarEvent(interview.interviewerId, interview.googleEventId);
          const reschedBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
          const reschedKitUrl = `${reschedBaseUrl}/interviews/${interview.id}`;
          const reschedPortalUrl = `${reschedBaseUrl}/status/${token}`;
          const reschedPhone = application.candidate.phone || 'Not provided';
          const reschedDesc = [
            `Rescheduled interview for ${application.job.title} position.`,
            ``,
            `📋 Interview Kit:`,
            reschedKitUrl,
            ``,
            `---`,
            `Candidate: ${application.candidate.firstName} ${application.candidate.lastName}`,
            `Phone: ${reschedPhone}`,
            `Email: ${application.candidate.email}`,
            `Candidate Portal: ${reschedPortalUrl}`,
          ].join('\n');
          const newEvent = await createCalendarEvent(
            interview.interviewerId,
            `Interview: ${application.candidate.firstName} ${application.candidate.lastName} - ${application.job.title}`,
            reschedDesc,
            scheduledAt,
            scheduledEnd,
            [interview.interviewer.email],
            { addGoogleMeet: interview.meetingLink?.includes('meet.google.com'), sendUpdates: 'none' }
          );

          // Update the interview with new event ID
          await prisma.interview.update({
            where: { id: interviewId },
            data: { googleEventId: newEvent.id },
          });
        } catch (recreateError) {
          console.error('Failed to recreate calendar event:', recreateError);
        }
      }
    }

    // Update Zoom meeting if it exists
    if (interview.zoomMeetingId) {
      try {
        await updateZoomMeeting(interview.zoomMeetingId, {
          startTime: scheduledAt,
          duration,
        });
      } catch (zoomError) {
        console.error('Failed to update Zoom meeting:', zoomError);
        // Zoom meetings are harder to recreate, just log the error
      }
    }

    // Update the interview
    const updatedInterview = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        scheduledAt,
        duration,
      },
      include: {
        interviewer: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    // Send rescheduled confirmation email
    const interviewerName = updatedInterview.interviewer
      ? `${updatedInterview.interviewer.firstName} ${updatedInterview.interviewer.lastName}`
      : undefined;

    try {
      const typeLabel = interview.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());
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
          location: interview.location || undefined,
          meetingLink: interview.meetingLink || undefined,
          interviewerName,
        },
      });
      const dbTemplate = await resolveTemplate('INTERVIEW_CONFIRMATION', mergeData);
      const emailTemplate = dbTemplate || interviewConfirmationTemplate(
        application.candidate.firstName,
        typeLabel,
        scheduledAt.toISOString(),
        duration,
        interview.location || undefined,
        interview.meetingLink || undefined,
        interviewerName
      );

      const sendResult = await sendEmail({
        to: application.candidate.email,
        subject: `Rescheduled: ${emailTemplate.subject}`,
        htmlBody: emailTemplate.html,
        from: 'RECRUITING',
      });

      await prisma.messageLog.create({
        data: {
          applicationId: application.id,
          type: 'EMAIL',
          recipient: application.candidate.email,
          subject: `Rescheduled: ${emailTemplate.subject}`,
          body: emailTemplate.html,
          status: 'SENT',
          postmarkMessageId: sendResult?.MessageID || null,
        },
      });
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
    }

    return NextResponse.json({
      success: true,
      interview: {
        id: updatedInterview.id,
        scheduledAt: updatedInterview.scheduledAt,
        duration: updatedInterview.duration,
        type: updatedInterview.type,
        location: updatedInterview.location,
        meetingLink: updatedInterview.meetingLink,
        interviewer: updatedInterview.interviewer,
      },
    });
  } catch (error) {
    console.error('Failed to reschedule interview:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule interview. Please try again.' },
      { status: 500 }
    );
  }
}
