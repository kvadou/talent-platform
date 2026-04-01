import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const DROPBOX_SIGN_WEBHOOK_SECRET = process.env.DROPBOX_SIGN_WEBHOOK_SECRET;

/**
 * Dropbox Sign Webhook Handler
 * Documentation: https://developers.hellosign.com/api/reference/webhook-api/
 *
 * Event types we handle:
 * - signature_request_signed: When all signers have signed
 * - signature_request_all_signed: (same as above, alternative event)
 * - signature_request_declined: When a signer declines
 * - signature_request_viewed: When document is viewed
 * - signature_request_sent: When request is sent
 */

interface DropboxSignWebhookPayload {
  event: {
    event_time: string;
    event_type: string;
    event_hash: string;
    event_metadata: {
      related_signature_id?: string;
      reported_for_account_id?: string;
    };
  };
  signature_request?: {
    signature_request_id: string;
    title: string;
    is_complete: boolean;
    is_declined: boolean;
    signatures: Array<{
      signature_id: string;
      signer_email_address: string;
      signer_name: string;
      status_code: string;
      signed_at: number | null;
    }>;
    metadata: Record<string, string>;
  };
  account_id?: string;
}

export async function POST(req: Request) {
  console.log('[Dropbox Sign Webhook] Received event');

  // Dropbox Sign sends webhooks as form-encoded data with a 'json' field
  let event: DropboxSignWebhookPayload;
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const jsonString = formData.get('json');
      if (!jsonString) {
        console.error('[Dropbox Sign Webhook] No json field in form data');
        return NextResponse.json({ error: 'Missing json field' }, { status: 400 });
      }
      event = JSON.parse(String(jsonString));
    } else {
      const payload = await req.text();
      event = JSON.parse(payload);
    }
  } catch (e) {
    console.error('[Dropbox Sign Webhook] Invalid payload:', e);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify webhook signature if secret is configured
  if (DROPBOX_SIGN_WEBHOOK_SECRET) {
    const expectedHash = crypto
      .createHmac('sha256', DROPBOX_SIGN_WEBHOOK_SECRET)
      .update(`${event.event.event_time}${event.event.event_type}`)
      .digest('hex');

    const hashBuf = Buffer.from(event.event.event_hash);
    const expBuf = Buffer.from(expectedHash);
    if (hashBuf.length !== expBuf.length || !crypto.timingSafeEqual(hashBuf, expBuf)) {
      console.error('[Dropbox Sign Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[Dropbox Sign Webhook] No webhook secret configured in production — rejecting');
    return new Response('Hello API Event Received', { status: 200 });
  } else {
    console.warn('[Dropbox Sign Webhook] No webhook secret configured, skipping verification in dev');
  }

  const eventType = event.event.event_type;
  console.log(`[Dropbox Sign Webhook] Event type: ${eventType}`);

  // Handle different event types
  switch (eventType) {
    case 'signature_request_signed':
    case 'signature_request_all_signed':
      await handleSignatureComplete(event);
      break;

    case 'signature_request_declined':
      await handleSignatureDeclined(event);
      break;

    case 'signature_request_viewed':
      // Optional: track when candidate views the offer
      console.log('[Dropbox Sign Webhook] Document viewed');
      break;

    case 'signature_request_sent':
      // Document successfully sent
      console.log('[Dropbox Sign Webhook] Document sent successfully');
      break;

    case 'callback_test':
      // Dropbox Sign sends this to verify webhook endpoint
      console.log('[Dropbox Sign Webhook] Callback test received');
      break;

    default:
      console.log(`[Dropbox Sign Webhook] Unhandled event type: ${eventType}`);
  }

  // Dropbox Sign expects "Hello API Event Received" response
  return new Response('Hello API Event Received', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function handleSignatureComplete(event: DropboxSignWebhookPayload) {
  const signatureRequest = event.signature_request;
  if (!signatureRequest) {
    console.error('[Dropbox Sign Webhook] No signature_request in event');
    return;
  }

  const requestId = signatureRequest.signature_request_id;

  // Find offer by Dropbox Sign request ID
  const offer = await prisma.offer.findFirst({
    where: { dropboxSignRequestId: requestId },
  });

  if (!offer) {
    console.log(`[Dropbox Sign Webhook] No offer found for request: ${requestId}`);
    return;
  }

  // Get signed timestamp from first signature
  const signedSignature = signatureRequest.signatures.find(
    (s) => s.status_code === 'signed' && s.signed_at
  );
  const signedAt = signedSignature?.signed_at
    ? new Date(signedSignature.signed_at * 1000)
    : new Date();

  // Update offer status to ACCEPTED
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: signedAt,
      respondedAt: signedAt,
    },
  });

  console.log(`[Dropbox Sign Webhook] Offer ${offer.id} marked as ACCEPTED`);

  // Update application status to HIRED
  await prisma.application.update({
    where: { id: offer.applicationId },
    data: {
      status: 'HIRED',
    },
  });

  console.log(`[Dropbox Sign Webhook] Application marked as HIRED`);

  // Trigger STT onboarding workflow
  await triggerSTTOnboarding(offer.applicationId);

  // Auto-export to contractors system
  await exportToContractors(offer.applicationId);
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

async function handleSignatureDeclined(event: DropboxSignWebhookPayload) {
  const signatureRequest = event.signature_request;
  if (!signatureRequest) {
    console.error('[Dropbox Sign Webhook] No signature_request in event');
    return;
  }

  const requestId = signatureRequest.signature_request_id;

  // Find offer by Dropbox Sign request ID
  const offer = await prisma.offer.findFirst({
    where: { dropboxSignRequestId: requestId },
  });

  if (!offer) {
    console.log(`[Dropbox Sign Webhook] No offer found for request: ${requestId}`);
    return;
  }

  // Update offer status to DECLINED
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: 'DECLINED',
      declinedAt: new Date(),
      respondedAt: new Date(),
      declineReason: 'Declined via Dropbox Sign',
    },
  });

  console.log(`[Dropbox Sign Webhook] Offer ${offer.id} marked as DECLINED`);

  // TODO: Send notification to recruiter
}

/**
 * Auto-export hired candidate to contractors system
 * Uses shared function from contractor-export lib
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

// Required: Dropbox Sign sends GET request to verify webhook endpoint
export async function GET() {
  return new Response('Hello API Event Received', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
