import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

// GET - Fetch application details for candidate portal
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getRequestIp(_);
  const limitResult = await rateLimit(`portal-status:${ip}`, 120, 60_000);
  if (!limitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { token } = await params;

  const includePayload = {
    application: {
      include: {
        candidate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          }
        },
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            market: {
              select: { name: true }
            }
          }
        },
        stage: {
          select: {
            id: true,
            name: true,
            order: true,
            defaultInterviewType: true
          }
        },
        stageHistory: {
          select: {
            id: true,
            stageId: true,
            movedAt: true,
            stage: {
              select: { name: true, order: true }
            }
          },
          orderBy: { movedAt: 'asc' as const }
        },
        interviews: {
          select: {
            id: true,
            scheduledAt: true,
            duration: true,
            type: true,
            location: true,
            meetingLink: true,
            interviewer: {
              select: { firstName: true, lastName: true }
            }
          },
          orderBy: { scheduledAt: 'asc' as const }
        },
        messages: {
          where: {
            type: 'EMAIL' as const,
            status: 'SENT' as const
          },
          select: {
            id: true,
            subject: true,
            sentAt: true
          },
          orderBy: { sentAt: 'desc' as const },
          take: 10
        },
        offer: {
          select: {
            id: true,
            status: true,
            salary: true,
            startDate: true,
            expiresAt: true
          }
        }
      }
    }
  };

  const tokenHash = hashToken(token);
  const tokenRecord = await prisma.applicationToken.findUnique({
    where: { token: tokenHash },
    include: includePayload,
  });

  if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  const application = tokenRecord.application;

  // Get all stages for this job to show full pipeline
  const allStages = await prisma.stage.findMany({
    where: { jobId: application.job.id },
    select: { id: true, name: true, order: true },
    orderBy: { order: 'asc' }
  });

  // Determine application status label
  let statusLabel = 'Under Review';
  let statusColor = 'blue';

  if (application.status === 'HIRED') {
    statusLabel = 'Offer Extended';
    statusColor = 'green';
  } else if (application.status === 'REJECTED') {
    statusLabel = 'Not Moving Forward';
    statusColor = 'gray';
  } else if (application.status === 'WITHDRAWN') {
    statusLabel = 'Withdrawn';
    statusColor = 'gray';
  } else {
    // Check for upcoming interviews
    const upcomingInterviews = application.interviews.filter(
      i => new Date(i.scheduledAt) > new Date()
    );
    if (upcomingInterviews.length > 0) {
      statusLabel = 'Interview Scheduled';
      statusColor = 'purple';
    }
  }

  return NextResponse.json({
    application: {
      id: application.id,
      status: application.status,
      statusLabel,
      statusColor,
      createdAt: application.createdAt,
      candidate: application.candidate,
      job: application.job,
      currentStage: application.stage,
      allStages,
      stageHistory: application.stageHistory,
      interviews: application.interviews,
      messages: application.messages,
      offer: application.offer
    }
  });
}

// POST - Withdraw application
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getRequestIp(req);
  const limitResult = await rateLimit(`portal-status-action:${ip}`, 40, 60_000);
  if (!limitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { token } = await params;
  const body = await req.json();
  const { action } = body;

  const postInclude = {
    application: {
      include: {
        candidate: true,
        job: true
      }
    }
  };

  const postTokenHash = hashToken(token);
  const tokenRecord = await prisma.applicationToken.findUnique({
    where: { token: postTokenHash },
    include: postInclude,
  });

  if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  if (action === 'withdraw') {
    // Check if application can be withdrawn
    if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(tokenRecord.application.status)) {
      return NextResponse.json({
        error: 'This application cannot be withdrawn'
      }, { status: 400 });
    }

    // Update application status
    await prisma.application.update({
      where: { id: tokenRecord.applicationId },
      data: { status: 'WITHDRAWN' }
    });

    // Log the withdrawal
    await prisma.messageLog.create({
      data: {
        applicationId: tokenRecord.applicationId,
        type: 'EMAIL',
        recipient: tokenRecord.application.candidate.email,
        subject: `Application Withdrawn: ${tokenRecord.application.job.title}`,
        body: 'Candidate withdrew their application via the candidate portal.',
        status: 'SENT'
      }
    });

    return NextResponse.json({ success: true, message: 'Application withdrawn' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
