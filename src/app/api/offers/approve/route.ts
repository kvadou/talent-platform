import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { approvalId, status, notes } = body;

  if (!approvalId || !status) {
    return NextResponse.json({
      error: 'approvalId and status are required'
    }, { status: 400 });
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({
      error: 'status must be APPROVED or REJECTED'
    }, { status: 400 });
  }

  // Find the approval and verify it belongs to this user
  const approval = await prisma.offerApproval.findFirst({
    where: {
      id: approvalId,
      userId: user.id
    },
    include: {
      offer: {
        include: {
          approvals: true
        }
      }
    }
  });

  if (!approval) {
    return NextResponse.json({
      error: 'Approval not found or you do not have permission'
    }, { status: 404 });
  }

  if (approval.status !== 'PENDING') {
    return NextResponse.json({
      error: 'This approval has already been processed'
    }, { status: 400 });
  }

  // Update the approval
  const updatedApproval = await prisma.offerApproval.update({
    where: { id: approvalId },
    data: {
      status,
      notes: notes || null,
      approvedAt: status === 'APPROVED' ? new Date() : null
    }
  });

  // Check if all approvals are complete
  const allApprovals = await prisma.offerApproval.findMany({
    where: { offerId: approval.offerId }
  });

  const allApproved = allApprovals.every(a => a.status === 'APPROVED');
  const anyRejected = allApprovals.some(a => a.status === 'REJECTED');

  // Update offer status based on approvals
  let newOfferStatus = approval.offer.status;
  if (anyRejected) {
    newOfferStatus = 'DRAFT'; // Send back to draft if rejected
  } else if (allApproved) {
    newOfferStatus = 'APPROVED';
  }

  if (newOfferStatus !== approval.offer.status) {
    await prisma.offer.update({
      where: { id: approval.offerId },
      data: { status: newOfferStatus }
    });
  }

  return NextResponse.json({
    approval: updatedApproval,
    offerStatus: newOfferStatus
  });
}
