import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import { sendBrandedEmail } from '@/lib/postmark';

/**
 * POST /api/offers/[id]/submit-for-approval
 *
 * Submit a draft offer for approval. Changes status to PENDING_APPROVAL
 * and notifies the hiring team.
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
          job: {
            select: {
              id: true,
              title: true,
              hiringTeam: {
                where: { role: { in: ['HIRING_MANAGER', 'RECRUITER'] } },
                include: {
                  user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  // Must be in DRAFT status to submit for approval
  if (offer.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Cannot submit offer with status: ' + offer.status },
      { status: 400 }
    );
  }

  // Get current user
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Update offer status to PENDING_APPROVAL
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      status: 'PENDING_APPROVAL',
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      applicationId: offer.applicationId,
      type: 'OFFER_CREATED',
      title: 'Offer submitted for approval',
      description: null,
      metadata: {
        offerId,
        submittedBy: user.firstName + ' ' + user.lastName,
      },
      userId: user.id,
    },
  });

  // Send notification emails to approvers
  const candidateName = offer.application.candidate.firstName + ' ' + offer.application.candidate.lastName;
  const jobTitle = offer.application.job.title;
  const compensation =
    offer.compensationType === 'HOURLY'
      ? '$' + offer.hourlyRate + '/hr'
      : offer.compensationType === 'SALARY'
        ? '$' + offer.salary + ' ' + (offer.salaryFrequency || 'annually')
        : 'TBD';

  // Get approvers from hiring team, fallback to HQ admins
  let approvers = offer.application.job.hiringTeam
    .filter((ht) => ht.role === 'HIRING_MANAGER')
    .map((ht) => ht.user);

  if (approvers.length === 0) {
    const admins = await prisma.user.findMany({
      where: { role: 'HQ_ADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    approvers = admins;
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
  const applicationLink = appBaseUrl + '/applications/' + offer.applicationId;

  for (const approver of approvers) {
    try {
      await sendBrandedEmail({
        to: approver.email,
        subject: 'Offer Approval Required: ' + candidateName + ' for ' + jobTitle,
        htmlBody: '<h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 600; color: #1f2937;">Offer Approval Required</h2><p style="margin: 0 0 16px 0; color: #4b5563;">An offer has been submitted for your approval:</p><table style="width: 100%; margin-bottom: 24px;" cellpadding="0" cellspacing="0"><tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong style="color: #6b7280;">Candidate:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">' + candidateName + '</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong style="color: #6b7280;">Position:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">' + jobTitle + '</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong style="color: #6b7280;">Compensation:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">' + compensation + '</td></tr><tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong style="color: #6b7280;">Submitted by:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">' + user.firstName + ' ' + user.lastName + '</td></tr></table><p style="margin: 0 0 24px 0; color: #4b5563;">Please review and approve or reject this offer.</p><div style="text-align: center;"><a href="' + applicationLink + '" style="display: inline-block; padding: 12px 24px; background-color: #6b46c1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Review Offer</a></div>',
        preheader: 'Offer approval needed for ' + candidateName,
        from: 'RECRUITING',
      });
    } catch (err) {
      console.error('Failed to send approval notification to ' + approver.email + ':', err);
    }
  }

  return NextResponse.json({
    success: true,
    offer: { id: offerId, status: 'PENDING_APPROVAL' },
    message: 'Offer submitted for approval. Approvers have been notified.',
    notifiedApprovers: approvers.length,
  });
}
