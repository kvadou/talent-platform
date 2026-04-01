import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { createInterviewZoomMeeting } from '@/lib/zoom';
import { sendInterviewScheduled } from '@/lib/notifications/email';
import { interviewScheduledTemplate } from '@/lib/email-templates';
import { format } from 'date-fns';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'upcoming'; // upcoming, past, all, pending
    const type = searchParams.get('type'); // PHONE_SCREEN, VIDEO_INTERVIEW, etc.
    const jobId = searchParams.get('jobId');

    // Get market access
    const access = await getUserMarkets(session.user.email);
    const marketWhere = access.marketIds ? { marketId: { in: access.marketIds } } : {};

    // Build date filter
    const now = new Date();
    let dateFilter = {};
    let feedbackFilter = {};

    if (filter === 'upcoming') {
      dateFilter = { scheduledAt: { gte: now } };
    } else if (filter === 'past') {
      dateFilter = { scheduledAt: { lt: now } };
    } else if (filter === 'pending') {
      dateFilter = { scheduledAt: { lt: now } };
      feedbackFilter = { feedback: { none: { userId: user.id } } };
    }

    // Build where clause
    const where: Record<string, unknown> = {
      interviewerId: user.id,
      ...dateFilter,
      ...feedbackFilter,
      application: {
        job: marketWhere,
      },
    };

    if (type) {
      where.type = type;
    }

    if (jobId) {
      where.application = {
        ...where.application as Record<string, unknown>,
        jobId,
      };
    }

    // Fetch interviews
    const interviews = await prisma.interview.findMany({
      where,
      orderBy: { scheduledAt: filter === 'past' || filter === 'pending' ? 'desc' : 'asc' },
      include: {
        application: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            job: {
              select: { id: true, title: true, location: true },
            },
            stage: {
              select: { id: true, name: true },
            },
          },
        },
        scorecard: {
          select: { id: true, name: true, criteria: true },
        },
        feedback: {
          where: { userId: user.id },
          select: { id: true, recommendation: true, submittedAt: true },
        },
      },
    });

    // Format response
    const formattedInterviews = interviews.map((interview) => ({
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      duration: interview.duration,
      type: interview.type,
      location: interview.location,
      meetingLink: interview.meetingLink,
      notes: interview.notes,
      candidate: {
        id: interview.application.candidate.id,
        name: `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`.trim(),
        email: interview.application.candidate.email,
      },
      job: {
        id: interview.application.job.id,
        title: interview.application.job.title,
        location: interview.application.job.location,
      },
      stage: interview.application.stage,
      applicationId: interview.applicationId,
      scorecard: interview.scorecard ? {
        id: interview.scorecard.id,
        name: interview.scorecard.name,
        hasCriteria: !!interview.scorecard.criteria,
      } : null,
      feedback: interview.feedback.length > 0 ? {
        id: interview.feedback[0].id,
        recommendation: interview.feedback[0].recommendation,
        submittedAt: interview.feedback[0].submittedAt,
      } : null,
      hasFeedback: interview.feedback.length > 0,
    }));

    // Get counts for filters
    const [upcomingCount, pastCount, pendingCount] = await Promise.all([
      prisma.interview.count({
        where: {
          interviewerId: user.id,
          scheduledAt: { gte: now },
          application: { job: marketWhere },
        },
      }),
      prisma.interview.count({
        where: {
          interviewerId: user.id,
          scheduledAt: { lt: now },
          application: { job: marketWhere },
        },
      }),
      prisma.interview.count({
        where: {
          interviewerId: user.id,
          scheduledAt: { lt: now },
          feedback: { none: { userId: user.id } },
          application: { job: marketWhere },
        },
      }),
    ]);

    return NextResponse.json({
      interviews: formattedInterviews,
      counts: {
        upcoming: upcomingCount,
        past: pastCount,
        pending: pendingCount,
        total: upcomingCount + pastCount,
      },
    });
  } catch (error) {
    console.error('Interviews API error:', error);
    return NextResponse.json(
      { error: 'Failed to load interviews' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();

  const form = await req.formData();
  const applicationId = String(form.get('applicationId'));
  const interviewerId = String(form.get('interviewerId'));
  const scheduledAt = form.get('scheduledAt')?.toString();
  const duration = Number(form.get('duration'));
  const type = form.get('type')?.toString() as any;
  const location = form.get('location')?.toString();
  const createZoomMeeting = form.get('createZoomMeeting') === 'true' || form.get('createZoomMeeting') === null; // Default to true
  const zoomHostEmail = form.get('zoomHostEmail')?.toString(); // Optional Zoom host email
  const meetingLink = form.get('meetingLink')?.toString();
  const scorecardId = form.get('scorecardId')?.toString();
  const recordingEnabled = form.get('recordingEnabled') === 'true'; // Recording toggle

  if (!applicationId || !interviewerId || !scheduledAt || !duration || !type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Fetch application with candidate and job details
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: true,
      job: true,
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Fetch interviewer details
  const interviewer = await prisma.user.findUnique({
    where: { id: interviewerId },
  });

  if (!interviewer) {
    return NextResponse.json({ error: 'Interviewer not found' }, { status: 404 });
  }

  const scheduledDate = new Date(scheduledAt);
  let finalMeetingLink: string | null = meetingLink || null;
  let zoomError: string | null = null;

  // Create the interview first
  const interview = await prisma.interview.create({
    data: {
      applicationId,
      interviewerId,
      scheduledAt: scheduledDate,
      duration,
      type,
      location: location || null,
      meetingLink: finalMeetingLink,
      scorecardId: scorecardId || null,
      recordingEnabled,
      confirmationSent: false,
      reminderSent: false,
    },
    include: {
      interviewer: true,
      application: {
        include: {
          candidate: true,
          job: true,
        },
      },
    },
  });

  // Create Zoom meeting if enabled and it's a Zoom-compatible interview type
  const zoomInterviewTypes = ['VIDEO_INTERVIEW', 'VIDEO_INTERVIEW_AUDITION', 'TECHNICAL_INTERVIEW', 'BEHAVIORAL_INTERVIEW', 'FINAL_INTERVIEW', 'PHONE_SCREEN'];
  if (createZoomMeeting && !finalMeetingLink && zoomInterviewTypes.includes(type)) {
    try {
      const zoomMeeting = await createInterviewZoomMeeting(
        interview.id,
        `${application.candidate.firstName} ${application.candidate.lastName}`,
        `${interviewer.firstName} ${interviewer.lastName}`,
        application.job.title,
        scheduledDate,
        duration,
        zoomHostEmail || undefined,
        recordingEnabled
      );
      finalMeetingLink = zoomMeeting.joinUrl;

      // Update interview with meeting link
      await prisma.interview.update({
        where: { id: interview.id },
        data: { meetingLink: finalMeetingLink },
      });
    } catch (error) {
      console.error('Failed to create Zoom meeting:', error);
      zoomError = error instanceof Error ? error.message : 'Unknown error';
      // Continue even if Zoom fails
    }
  }

  // Send email notifications
  try {
    const formattedDate = format(scheduledDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
    const finalLocation = finalMeetingLink ? undefined : location || undefined;

    // Get email template for logging
    const candidateTemplate = interviewScheduledTemplate(
      application.candidate.firstName,
      formattedDate,
      finalLocation,
      finalMeetingLink || undefined
    );

    // Send to candidate
    await sendInterviewScheduled(
      application.candidate.email,
      application.candidate.firstName,
      formattedDate,
      finalLocation,
      finalMeetingLink || undefined
    );

    // Log the candidate email to MessageLog
    await prisma.messageLog.create({
      data: {
        applicationId: applicationId,
        type: 'EMAIL',
        recipient: application.candidate.email,
        subject: candidateTemplate.subject,
        body: candidateTemplate.html,
        status: 'SENT',
      },
    });

    // Send to interviewer (not logged as it's internal)
    await sendInterviewScheduled(
      interviewer.email,
      interviewer.firstName,
      formattedDate,
      finalLocation,
      finalMeetingLink || undefined
    );

    // Mark confirmation as sent
    await prisma.interview.update({
      where: { id: interview.id },
      data: { confirmationSent: true },
    });
  } catch (error) {
    console.error('Failed to send interview notifications:', error);
    // Don't fail the request if email fails
  }

  // Fetch updated interview with meeting link
  const updatedInterview = await prisma.interview.findUnique({
    where: { id: interview.id },
    include: {
      interviewer: true,
      application: {
        include: {
          candidate: true,
          job: true,
        },
      },
    },
  });

  return NextResponse.json({
    interview: updatedInterview,
    zoomMeetingCreated: !!finalMeetingLink && !meetingLink, // Only true if we created it (not provided)
    zoomError: zoomError || undefined,
  });
}
