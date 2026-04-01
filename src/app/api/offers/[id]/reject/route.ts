import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import { z } from 'zod';

const rejectOfferSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

/**
 * POST /api/offers/[id]/reject
 *
 * Reject an offer approval. Updates the OfferApproval record
 * and keeps the offer in PENDING_APPROVAL status (or moves to DRAFT).
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
  const { id: offerId } = await params;

  // Parse request
  const body = await req.json();
  const parseResult = rejectOfferSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { reason } = parseResult.data;

  // Fetch offer with access check
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: {
        ...(access.marketIds
          ? { job: { marketId: { in: access.marketIds } } }
          : {}),
      },
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
        },
      },
      approvals: true,
    },
  });

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  // Must be in PENDING_APPROVAL or DRAFT status to reject
  if (offer.status !== 'PENDING_APPROVAL' && offer.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot reject offer with status: ${offer.status}` },
      { status: 400 }
    );
  }

  // Get user details
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Determine approver role based on user role
  const approverRole = user.role === 'HQ_ADMIN' ? 'executive' : 'hiring_manager';

  // Create or update approval with REJECTED status
  const existingApproval = offer.approvals.find((a) => a.userId === user.id);

  const approval = await prisma.offerApproval.upsert({
    where: {
      id: existingApproval?.id || 'new',
    },
    create: {
      offerId,
      userId: user.id,
      role: approverRole,
      status: 'REJECTED',
      notes: reason,
    },
    update: {
      status: 'REJECTED',
      notes: reason,
    },
  });

  // Move offer back to DRAFT status for revision
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'DRAFT',
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      applicationId: offer.applicationId,
      type: 'OFFER_CREATED', // Using existing type for approval rejection
      title: 'Offer approval rejected',
      description: reason,
      metadata: {
        offerId,
        rejectedBy: `${user.firstName} ${user.lastName}`,
        role: approverRole,
        reason,
      },
      userId: user.id,
    },
  });

  return NextResponse.json({
    success: true,
    approval,
    offer: { id: offerId, status: 'DRAFT' },
    message: 'Offer has been rejected and returned to draft status for revision.',
  });
}
