import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';
import {
  listTemplates,
  createDocument,
  getDocumentStatus,
  isESignConfigured,
} from '@/lib/esign';
import { z } from 'zod';

const sendSignatureSchema = z.object({
  offerId: z.string().min(1, 'Offer ID required'),
  templateId: z.string().min(1, 'Template ID required'),
  subject: z.string().optional(),
  message: z.string().optional(),
  resend: z.boolean().optional(),
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
    if (!isESignConfigured()) {
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
          id: t.id,
          title: t.name,
          signerRoles: t.signerRoles.map(r => ({ name: r.name, order: r.order })),
          customFields: t.fields.filter(f => f.type === 'TEXT').map(f => ({ name: f.label, type: 'text' })),
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
        esignDocumentId: true,
        dropboxSignRequestId: true, // Keep for backwards compatibility
        status: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Check esign first, fallback to dropbox sign
    const documentId = offer.esignDocumentId || offer.dropboxSignRequestId;

    if (!documentId) {
      return NextResponse.json({
        signatureStatus: null,
        message: 'No signature request associated with this offer',
      });
    }

    // If it's an esign document
    if (offer.esignDocumentId) {
      try {
        const document = await getDocumentStatus(offer.esignDocumentId);
        return NextResponse.json({
          signatureStatus: {
            requestId: document.id,
            isComplete: document.status === 'COMPLETED',
            isDeclined: document.signers.some(s => s.status === 'DECLINED'),
            signatures: document.signers.map((s) => ({
              email: s.email,
              name: s.name,
              status: s.status.toLowerCase().replace('_', ' '),
              signedAt: s.signedAt || null,
            })),
            createdAt: document.createdAt,
          },
        });
      } catch (error) {
        console.error('Failed to get document status:', error);
        return NextResponse.json(
          { error: 'Failed to get signature status' },
          { status: 500 }
        );
      }
    }

    // Legacy: dropbox sign - return null to indicate migration needed
    return NextResponse.json({
      signatureStatus: null,
      message: 'Legacy Dropbox Sign request - please resend via E-Sign',
      legacy: true,
    });
  }

  return NextResponse.json({
    configured: isESignConfigured(),
  });
}

// POST - Send signature request for an offer
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isESignConfigured()) {
    return NextResponse.json(
      { error: 'E-Sign integration not configured. Add ESIGN_API_KEY to environment.' },
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

  const { offerId, templateId, subject, message, resend } = parseResult.data;

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
  if (offer.esignDocumentId && !resend) {
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

  // Build merge data for template
  const mergeData: Record<string, string> = {
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
  };

  // Add compensation fields
  if (offer.compensationType === 'HOURLY' && offer.hourlyRate) {
    mergeData.hourly_rate = `$${Number(offer.hourlyRate).toFixed(2)}`;
    mergeData.compensation = `$${Number(offer.hourlyRate).toFixed(2)} per hour`;
  } else if (offer.compensationType === 'SALARY' && offer.salary) {
    mergeData.salary = `$${Number(offer.salary).toLocaleString()}`;
    mergeData.compensation = `$${Number(offer.salary).toLocaleString()} ${offer.salaryFrequency?.toLowerCase() || 'annually'}`;
  }

  try {
    const document = await createDocument({
      templateId,
      title: `${job.title} - Offer Letter for ${candidate.firstName} ${candidate.lastName}`,
      signers: [
        {
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          role: 'Signer', // Default role name - templates should have this role
          order: 1,
        },
      ],
      mergeData,
      signingOrderType: 'PARALLEL',
      emailSubject: subject || `Offer Letter - ${job.title}`,
      emailMessage: message || `Please review and sign your offer letter for the ${job.title} position.`,
      metadata: {
        offer_id: offer.id,
        candidate_id: candidate.id,
        application_id: offer.applicationId,
        job_title: job.title,
      },
    });

    // Update offer with esign document ID and status
    const updatedOffer = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        esignDocumentId: document.id,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      offer: updatedOffer,
      signatureRequest: {
        id: document.id,
        embedUrl: document.signers[0]?.embedUrl,
        signUrl: document.signers[0]?.signUrl,
      },
      message: 'Offer letter sent for signature',
    });
  } catch (error) {
    console.error('E-Sign API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send signature request' },
      { status: 500 }
    );
  }
}
