import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import { z } from 'zod';

const hireWorkflowSchema = z.object({
  action: z.enum([
    'check_status',        // Get current workflow status
    'initiate_check',      // Start background check
    'skip_check',          // Skip background check (manual override)
    'create_offer',        // Create offer
    'approve_offer',       // Approve offer
    'send_offer',          // Send offer for signature
    'mark_hired',          // Manually mark as hired
  ]),
  // Additional data for specific actions
  checkrPackage: z.string().optional(),
  offerData: z.object({
    compensationType: z.enum(['HOURLY', 'SALARY', 'CONTRACT']),
    hourlyRate: z.number().nullable().optional(),
    salary: z.number().nullable().optional(),
    startDate: z.string().optional(),
  }).optional(),
});

type WorkflowStatus = {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  currentStage: string;
  applicationStatus: string;
  steps: {
    backgroundCheck: {
      status: 'not_started' | 'pending' | 'processing' | 'complete' | 'skipped' | 'failed';
      result?: string;
      canProceed: boolean;
    };
    offer: {
      status: 'not_created' | 'draft' | 'pending_approval' | 'approved' | 'sent' | 'accepted' | 'declined';
      canCreate: boolean;
      canSend: boolean;
    };
    hire: {
      status: 'pending' | 'hired';
      canHire: boolean;
    };
  };
  nextAction: string;
  blockers: string[];
};

/**
 * GET /api/applications/[id]/hire-workflow
 *
 * Returns the current hiring workflow status for an application,
 * including what steps are complete and what the next action should be.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  const { id: applicationId } = await params;

  // Fetch application with all related data
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      ...(access.marketIds
        ? { job: { marketId: { in: access.marketIds } } }
        : {}),
    },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          backgroundChecks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      job: { select: { title: true } },
      stage: { select: { name: true } },
      offer: { select: { id: true, status: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const status = buildWorkflowStatus(application);

  return NextResponse.json({ status });
}

/**
 * POST /api/applications/[id]/hire-workflow
 *
 * Execute a hiring workflow action.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  const { id: applicationId } = await params;

  // Parse request
  const body = await req.json();
  const parseResult = hireWorkflowSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { action } = parseResult.data;

  // Fetch application with all related data
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      ...(access.marketIds
        ? { job: { marketId: { in: access.marketIds } } }
        : {}),
    },
    include: {
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          backgroundChecks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      job: { select: { id: true, title: true } },
      stage: { select: { name: true } },
      offer: { select: { id: true, status: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const currentStatus = buildWorkflowStatus(application);

  switch (action) {
    case 'check_status':
      return NextResponse.json({ status: currentStatus });

    case 'skip_check':
      // Record that background check was skipped
      await prisma.activityLog.create({
        data: {
          applicationId,
          type: 'STAGE_CHANGE',
          title: 'Background check skipped',
          description: 'Background check was manually skipped in hiring workflow',
          userId: (await prisma.user.findUnique({ where: { email: session.user.email } }))?.id,
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Background check skipped',
        status: buildWorkflowStatus(application),
      });

    case 'mark_hired':
      // Verify offer is accepted or override allowed
      if (application.offer?.status !== 'ACCEPTED') {
        return NextResponse.json(
          { error: 'Cannot mark as hired - offer has not been accepted' },
          { status: 400 }
        );
      }

      await prisma.application.update({
        where: { id: applicationId },
        data: { status: 'HIRED' },
      });

      await prisma.activityLog.create({
        data: {
          applicationId,
          type: 'STAGE_CHANGE',
          title: 'Marked as hired',
          description: 'Candidate has been marked as hired',
          userId: (await prisma.user.findUnique({ where: { email: session.user.email } }))?.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Application marked as hired',
        status: buildWorkflowStatus({ ...application, status: 'HIRED' }),
      });

    default:
      return NextResponse.json(
        { error: 'Action not implemented: ' + action },
        { status: 400 }
      );
  }
}

function buildWorkflowStatus(application: {
  id: string;
  status: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    backgroundChecks: Array<{ status: string; result: string | null }>;
  };
  job: { title: string };
  stage: { name: string } | null;
  offer: { id: string; status: string } | null;
}): WorkflowStatus {
  const bgCheck = application.candidate.backgroundChecks[0];
  const offer = application.offer;

  // Determine background check status
  let bgCheckStatus: WorkflowStatus['steps']['backgroundCheck']['status'] = 'not_started';
  let bgCheckResult: string | undefined;
  let bgCanProceed = true;

  if (bgCheck) {
    bgCheckStatus = bgCheck.status as WorkflowStatus['steps']['backgroundCheck']['status'];
    bgCheckResult = bgCheck.result || undefined;
    bgCanProceed = bgCheck.status === 'complete' && bgCheck.result === 'clear';
  }

  // Determine offer status
  let offerStatus: WorkflowStatus['steps']['offer']['status'] = 'not_created';
  if (offer) {
    offerStatus = offer.status.toLowerCase().replace('_', '_') as WorkflowStatus['steps']['offer']['status'];
  }

  // Determine hire status
  const hireStatus: WorkflowStatus['steps']['hire']['status'] =
    application.status === 'HIRED' ? 'hired' : 'pending';

  // Build blockers list
  const blockers: string[] = [];
  if (bgCheck && bgCheck.status !== 'complete') {
    blockers.push('Background check is still ' + bgCheck.status);
  }
  if (bgCheck && bgCheck.result === 'consider') {
    blockers.push('Background check requires review');
  }
  if (offer && offer.status === 'PENDING_APPROVAL') {
    blockers.push('Offer is awaiting approval');
  }

  // Determine next action
  let nextAction = '';
  if (hireStatus === 'hired') {
    nextAction = 'Complete - candidate has been hired';
  } else if (!offer) {
    nextAction = bgCanProceed || bgCheckStatus === 'not_started'
      ? 'Create an offer'
      : 'Wait for background check to complete';
  } else if (offer.status === 'DRAFT') {
    nextAction = 'Submit offer for approval';
  } else if (offer.status === 'PENDING_APPROVAL') {
    nextAction = 'Approve the offer';
  } else if (offer.status === 'APPROVED') {
    nextAction = 'Send offer for signature';
  } else if (offer.status === 'SENT') {
    nextAction = 'Waiting for candidate to sign';
  } else if (offer.status === 'ACCEPTED') {
    nextAction = 'Mark candidate as hired';
  } else if (offer.status === 'DECLINED') {
    nextAction = 'Offer was declined - create new offer or reject candidate';
  }

  return {
    applicationId: application.id,
    candidateName: application.candidate.firstName + ' ' + application.candidate.lastName,
    jobTitle: application.job.title,
    currentStage: application.stage?.name || 'Unknown',
    applicationStatus: application.status,
    steps: {
      backgroundCheck: {
        status: bgCheckStatus,
        result: bgCheckResult,
        canProceed: bgCanProceed || bgCheckStatus === 'not_started',
      },
      offer: {
        status: offerStatus,
        canCreate: !offer,
        canSend: offer?.status === 'APPROVED',
      },
      hire: {
        status: hireStatus,
        canHire: offer?.status === 'ACCEPTED',
      },
    },
    nextAction,
    blockers,
  };
}
