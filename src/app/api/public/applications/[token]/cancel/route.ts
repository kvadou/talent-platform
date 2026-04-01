import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { deleteCalendarEvent } from '@/lib/google-calendar';
import { deleteZoomMeeting } from '@/lib/zoom';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

// POST - Cancel an interview (candidate self-service)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(req);
    const limitResult = await rateLimit(`portal-cancel:${ip}`, 20, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const body = await req.json();
    const { interviewId, reason } = body;

    if (!interviewId) {
      return NextResponse.json(
        { error: 'interviewId is required' },
        { status: 400 }
      );
    }

    // Validate the token
    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token: tokenHash },
      include: {
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
      },
    });

    if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const application = tokenRecord.application;
    const interview = application.interviews[0];

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Don't allow cancelling past interviews
    if (new Date(interview.scheduledAt) < new Date()) {
      return NextResponse.json(
        { error: 'Cannot cancel a past interview' },
        { status: 400 }
      );
    }

    // Delete Google Calendar event if it exists
    if (interview.googleEventId && interview.interviewer) {
      try {
        await deleteCalendarEvent(interview.interviewerId, interview.googleEventId);
      } catch (calendarError) {
        console.error('Failed to delete calendar event:', calendarError);
      }
    }

    // Delete Zoom meeting if it exists
    if (interview.zoomMeetingId) {
      try {
        await deleteZoomMeeting(interview.zoomMeetingId);
      } catch (zoomError) {
        console.error('Failed to delete Zoom meeting:', zoomError);
      }
    }

    // Update the interview record
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        googleEventId: null,
        zoomMeetingId: null,
        notes: reason ? `Cancelled by candidate: ${reason}` : 'Cancelled by candidate',
      },
    });

    // Add a note to the application
    await prisma.note.create({
      data: {
        applicationId: application.id,
        content: reason
          ? `Candidate cancelled interview: ${reason}`
          : 'Candidate cancelled their interview.',
        authorId: interview.interviewerId,
      },
    });

    // Notify the interviewer via email
    if (interview.interviewer?.email) {
      const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;

      // Get interviewer's timezone for formatting
      const interviewerUser = await prisma.user.findUnique({
        where: { id: interview.interviewerId },
        select: { timezone: true },
      });
      const tz = interviewerUser?.timezone || 'America/New_York';

      const scheduledDate = new Date(interview.scheduledAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
        timeZoneName: 'short',
      });

      try {
        const sendResult = await sendEmail({
          to: interview.interviewer.email,
          subject: `Interview Cancelled: ${candidateName} — ${application.job.title}`,
          htmlBody: `
            <p>Hi ${interview.interviewer.firstName},</p>
            <p><strong>${candidateName}</strong> has cancelled their interview for the <strong>${application.job.title}</strong> position that was scheduled for <strong>${scheduledDate}</strong>.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>The calendar event has been removed automatically.</p>
          `,
          from: 'RECRUITING',
        });

        // Log the cancellation notification
        await prisma.messageLog.create({
          data: {
            applicationId: application.id,
            type: 'EMAIL',
            recipient: interview.interviewer.email,
            subject: `Interview Cancelled: ${candidateName} — ${application.job.title}`,
            body: reason || 'No reason provided',
            status: 'SENT',
            postmarkMessageId: sendResult?.MessageID || null,
          },
        });
      } catch (emailError) {
        console.error('Failed to send cancellation notification:', emailError);
        // Still log the cancellation even if email failed
        await prisma.messageLog.create({
          data: {
            applicationId: application.id,
            type: 'EMAIL',
            recipient: interview.interviewer?.email || '',
            subject: 'Interview cancelled by candidate',
            body: reason || 'No reason provided',
            status: 'FAILED',
          },
        });
      }
    } else {
      // No interviewer email, just log the cancellation
      await prisma.messageLog.create({
        data: {
          applicationId: application.id,
          type: 'EMAIL',
          recipient: '',
          subject: 'Interview cancelled by candidate',
          body: reason || 'No reason provided',
          status: 'SENT',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Interview cancelled successfully',
    });
  } catch (error) {
    console.error('Failed to cancel interview:', error);
    return NextResponse.json(
      { error: 'Failed to cancel interview. Please try again.' },
      { status: 500 }
    );
  }
}
