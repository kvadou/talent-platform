import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import {
  listTemplates,
  sendSignatureRequest,
  getSignatureRequest,
  isDropboxSignConfigured,
} from '@/lib/dropbox-sign';
import { z } from 'zod';

const sendSignatureSchema = z.object({
  offerId: z.string().min(1, 'Offer ID required'),
  templateId: z.string().min(1, 'Template ID required'),
  subject: z.string().optional(),
  message: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  resend: z.boolean().optional(), // Allow resending even if already sent
});

// GET - List templates or get signature request status
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const offerId = url.searchParams.get('offerId');

  // Return integration status and templates
  if (action === 'templates') {
    if (!isDropboxSignConfigured()) {
      return NextResponse.json({
        configured: false,
        templates: [],
      });
    }

    try {
      const templates = await listTemplates();
      return NextResponse.json({
        configured: true,
        templates: templates.map((t) => ({
          id: t.template_id,
          title: t.title,
          signerRoles: t.signer_roles,
          customFields: t.custom_fields,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }
  }

  // Get signature status for an offer
  if (offerId) {
    await ensureUser();
    const access = await getUserMarkets(session.user.email);

    const offer = await prisma.offer.findFirst({
      where: {
        id: offerId,
        application: {
          job: access.marketIds ? { marketId: { in: access.marketIds } } : {},
        },
      },
      select: {
        id: true,
        dropboxSignRequestId: true,
        status: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (!offer.dropboxSignRequestId) {
      return NextResponse.json({
        signatureStatus: null,
        message: 'No signature request associated with this offer',
      });
    }

    try {
      const signatureRequest = await getSignatureRequest(offer.dropboxSignRequestId);
      return NextResponse.json({
        signatureStatus: {
          requestId: signatureRequest.signature_request_id,
          isComplete: signatureRequest.is_complete,
          isDeclined: signatureRequest.is_declined,
          signatures: signatureRequest.signatures.map((s) => ({
            email: s.signer_email_address,
            name: s.signer_name,
            status: s.status_code,
            signedAt: s.signed_at ? new Date(s.signed_at * 1000).toISOString() : null,
          })),
          createdAt: new Date(signatureRequest.created_at * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to get signature status:', error);
      return NextResponse.json(
        { error: 'Failed to get signature status' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    configured: isDropboxSignConfigured(),
  });
}

// POST - Send signature request for an offer
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDropboxSignConfigured()) {
    return NextResponse.json(
      { error: 'Dropbox Sign integration not configured. Add DROPBOX_SIGN_API_KEY to environment.' },
      { status: 503 }
    );
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  // Parse request
  const body = await req.json();
  const parseResult = sendSignatureSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { offerId, templateId, subject, message, customFields, resend } = parseResult.data;

  // Fetch offer with candidate info
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: {
        job: access.marketIds ? { marketId: { in: access.marketIds } } : {},
      },
    },
    include: {
      application: {
        include: {
          candidate: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          job: {
            select: {
              title: true,
              market: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  // Check if already sent (allow resending with flag)
  if (offer.dropboxSignRequestId && !resend) {
    return NextResponse.json(
      { error: 'Signature request already sent for this offer', alreadySent: true },
      { status: 409 }
    );
  }

  // Only send approved, draft, or sent (for resend) offers
  if (!['DRAFT', 'APPROVED', 'SENT'].includes(offer.status)) {
    return NextResponse.json(
      { error: `Cannot send signature request for offer in ${offer.status} status` },
      { status: 400 }
    );
  }

  const candidate = offer.application.candidate;
  const job = offer.application.job;

  // Build custom fields for template merge
  const mergeFields: Record<string, string> = {
    candidate_name: `${candidate.firstName} ${candidate.lastName}`,
    candidate_first_name: candidate.firstName,
    candidate_last_name: candidate.lastName,
    job_title: job.title,
    market: job.market.name,
    start_date: offer.startDate
      ? new Date(offer.startDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD',
    ...customFields,
  };

  // Add compensation fields
  if (offer.compensationType === 'HOURLY' && offer.hourlyRate) {
    mergeFields.hourly_rate = `$${Number(offer.hourlyRate).toFixed(2)}`;
    mergeFields.compensation = `$${Number(offer.hourlyRate).toFixed(2)} per hour`;
  } else if (offer.compensationType === 'SALARY' && offer.salary) {
    mergeFields.salary = `$${Number(offer.salary).toLocaleString()}`;
    mergeFields.compensation = `$${Number(offer.salary).toLocaleString()} ${offer.salaryFrequency?.toLowerCase() || 'annually'}`;
  }

  try {
    const signatureRequest = await sendSignatureRequest({
      templateId,
      signerEmail: candidate.email,
      signerName: `${candidate.firstName} ${candidate.lastName}`,
      subject: subject || `Offer Letter - ${job.title}`,
      message: message || `Please review and sign your offer letter for the ${job.title} position.`,
      customFields: mergeFields,
      // Use test mode if env var is set OR in non-production environment
      // Free Dropbox Sign API plan requires test_mode=1
      testMode: process.env.DROPBOX_SIGN_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production',
      metadata: {
        offer_id: offer.id,
        candidate_id: candidate.id,
        job_title: job.title,
      },
    });

    // Update offer with signature request ID and status
    const updatedOffer = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        dropboxSignRequestId: signatureRequest.signature_request_id,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      offer: updatedOffer,
      signatureRequest: {
        id: signatureRequest.signature_request_id,
        detailsUrl: signatureRequest.details_url,
      },
      message: 'Offer letter sent for signature',
    });
  } catch (error) {
    console.error('Dropbox Sign API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send signature request' },
      { status: 500 }
    );
  }
}
