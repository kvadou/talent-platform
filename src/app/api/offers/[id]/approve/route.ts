import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import { z } from 'zod';

const approveOfferSchema = z.object({
  notes: z.string().optional(),
});

/**
 * POST /api/offers/[id]/approve
 *
 * Approve an offer. Creates or updates an OfferApproval record
 * and updates the offer status to APPROVED if all approvals are in.
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
  const parseResult = approveOfferSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { notes } = parseResult.data;

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

  // Must be in PENDING_APPROVAL status to approve
  if (offer.status !== 'PENDING_APPROVAL' && offer.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot approve offer with status: ${offer.status}` },
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

  // Create or update approval
  const existingApproval = offer.approvals.find((a) => a.userId === user.id);

  const approval = await prisma.offerApproval.upsert({
    where: {
      id: existingApproval?.id || 'new',
    },
    create: {
      offerId,
      userId: user.id,
      role: approverRole,
      status: 'APPROVED',
      notes,
      approvedAt: new Date(),
    },
    update: {
      status: 'APPROVED',
      notes,
      approvedAt: new Date(),
    },
  });

  // Update offer status to APPROVED
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'APPROVED',
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      applicationId: offer.applicationId,
      type: 'OFFER_CREATED', // Using existing type for approval
      title: 'Offer approved',
      description: notes || null,
      metadata: {
        offerId,
        approvedBy: `${user.firstName} ${user.lastName}`,
        role: approverRole,
      },
      userId: user.id,
    },
  });

  return NextResponse.json({
    success: true,
    approval,
    offer: { id: offerId, status: 'APPROVED' },
  });
}
