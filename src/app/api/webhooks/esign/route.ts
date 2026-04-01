import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const ESIGN_WEBHOOK_SECRET = process.env.ESIGN_WEBHOOK_SECRET;

/**
 * STC E-Sign Webhook Handler
 *
 * Event types we handle:
 * - document.completed: When all signers have signed
 * - signer.signed: When a signer completes signing
 * - signer.declined: When a signer declines
 * - signer.viewed: When a signer views the document
 */

/**
 * Webhook payload from stc-esign
 * Structure: { event, data: { ...payload }, timestamp, deliveryId }
 */
interface ESignWebhookPayload {
  event: string;
  timestamp: string;
  deliveryId?: string;
  data: {
    documentId: string;
    status?: string;
    signerId?: string;
    signerName?: string;
    signerEmail?: string;
    declineReason?: string;
    signerCount?: number;
    metadata?: Record<string, string>;
  };
}

export async function POST(req: Request) {
  console.log('[E-Sign Webhook] Received event');

  // Get raw body for signature verification
  const rawBody = await req.text();
  let event: ESignWebhookPayload;

  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error('[E-Sign Webhook] Invalid JSON payload:', e);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify webhook signature — require secret in all environments
  if (!ESIGN_WEBHOOK_SECRET) {
    console.error('[E-Sign Webhook] ESIGN_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  {
    const signature = req.headers.get('x-esign-signature');
    if (!signature) {
      console.error('[E-Sign Webhook] Missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', ESIGN_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.error('[E-Sign Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const eventType = event.event;
  console.log(`[E-Sign Webhook] Event type: ${eventType}`);

  // Handle different event types
  switch (eventType) {
    case 'document.completed':
    case 'signer.signed':
      await handleSignerSigned(event);
      break;

    case 'signer.declined':
      await handleSignerDeclined(event);
      break;

    case 'signer.viewed':
      console.log('[E-Sign Webhook] Document viewed by:', event.data.signerEmail);
      break;

    case 'document.sent':
      console.log('[E-Sign Webhook] Document sent successfully');
      break;

    default:
      console.log(`[E-Sign Webhook] Unhandled event type: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}

async function handleSignerSigned(event: ESignWebhookPayload) {
  const documentId = event.data.documentId;
  const metadata = event.data.metadata;

  // Try to find offer by document ID
  let offer = await prisma.offer.findFirst({
    where: { esignDocumentId: documentId },
  });

  // Fallback: try metadata.offer_id
  if (!offer && metadata?.offer_id) {
    offer = await prisma.offer.findUnique({
      where: { id: metadata.offer_id },
    });
  }

  if (!offer) {
    console.log(`[E-Sign Webhook] No offer found for document: ${documentId}`);
    return;
  }

  // Only update if document is fully completed
  if (event.data.status !== 'COMPLETED' && event.event !== 'document.completed') {
    console.log(`[E-Sign Webhook] Document not yet completed, status: ${event.data.status}`);
    return;
  }

  // Update offer status to ACCEPTED
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      respondedAt: new Date(),
    },
  });

  console.log(`[E-Sign Webhook] Offer ${offer.id} marked as ACCEPTED`);

  // Update application status to HIRED
  await prisma.application.update({
    where: { id: offer.applicationId },
    data: {
      status: 'HIRED',
    },
  });

  console.log(`[E-Sign Webhook] Application marked as HIRED`);

  // Trigger STT onboarding workflow
  await triggerSTTOnboarding(offer.applicationId);

  // Auto-export to contractors system
  await exportToContractors(offer.applicationId);
}

async function handleSignerDeclined(event: ESignWebhookPayload) {
  const documentId = event.data.documentId;
  const metadata = event.data.metadata;

  // Try to find offer by document ID
  let offer = await prisma.offer.findFirst({
    where: { esignDocumentId: documentId },
  });

  // Fallback: try metadata.offer_id
  if (!offer && metadata?.offer_id) {
    offer = await prisma.offer.findUnique({
      where: { id: metadata.offer_id },
    });
  }

  if (!offer) {
    console.log(`[E-Sign Webhook] No offer found for document: ${documentId}`);
    return;
  }

  // Update offer status to DECLINED
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
      respondedAt: new Date(),
      declineReason: `Declined via E-Sign by ${event.data.signerName || 'signer'}`,
    },
  });

  console.log(`[E-Sign Webhook] Offer ${offer.id} marked as DECLINED`);
}

/**
 * Send hire event to external platform to trigger onboarding
 */
async function triggerSTTOnboarding(applicationId: string) {
  const STT_WEBHOOK_URL = process.env.STT_WEBHOOK_URL || 'http://localhost:3000/api/webhooks/ats';
  const STT_WEBHOOK_SECRET = process.env.STT_WEBHOOK_SECRET;

  if (!STT_WEBHOOK_SECRET) {
    console.log('[STT Webhook] STT_WEBHOOK_SECRET not configured, skipping');
    return;
  }

  try {
    // Get application with candidate and job data
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: {
          include: {
            market: true,
          },
        },
      },
    });

    if (!application || !application.candidate) {
      console.error('[STT Webhook] Application or candidate not found');
      return;
    }

    const candidate = application.candidate;

    // Map market to team
    const teamMap: Record<string, string> = {
      'los-angeles': 'LA',
      'new-york': 'NYC',
      'san-francisco': 'SF',
      'westside': 'WESTSIDE',
      'eastside': 'EASTSIDE',
      'online': 'ONLINE',
    };
    const team = application.job?.market?.slug
      ? teamMap[application.job.market.slug] || null
      : null;

    // Build webhook payload
    const payload = {
      event: 'candidate.hired',
      timestamp: new Date().toISOString(),
      candidate: {
        id: candidate.id,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        phone: candidate.phone || undefined,
      },
      application: {
        id: application.id,
        jobTitle: application.job?.title || 'Chess Tutor',
        hireDate: new Date().toISOString().split('T')[0],
      },
      metadata: {
        team,
        source: application.source || 'ats',
      },
    };

    // Send to STT
    const response = await fetch(STT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ATS-Signature': STT_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[STT Webhook] Failed to send hire event: ${response.status} - ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log('[STT Webhook] Hire event sent successfully:', result);

    // Store the STT user ID if returned
    if (result.user?.id) {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          sttUserId: String(result.user.id),
        },
      });
      console.log(`[STT Webhook] Stored sttUserId: ${result.user.id} for application ${applicationId}`);
    }
  } catch (error) {
    console.error('[STT Webhook] Error sending hire event:', error);
  }
}

/**
 * Auto-export hired candidate to contractors system
 */
async function exportToContractors(applicationId: string) {
  try {
    const { exportSingleCandidate } = await import('@/lib/integrations/contractor-export');
    const result = await exportSingleCandidate(applicationId);

    if (result.success) {
      console.log(`[Contractor Export] Exported application ${applicationId} as contractor ${result.contractorId}`);
    } else {
      console.log(`[Contractor Export] Skipped: ${result.error}`);
    }
  } catch (error) {
    console.error('[Contractor Export] Error:', error);
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'esign-webhook' });
}
