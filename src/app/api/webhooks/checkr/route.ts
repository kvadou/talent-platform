import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/checkr';
import { sendBrandedEmail } from '@/lib/postmark';

const CHECKR_WEBHOOK_SECRET = process.env.CHECKR_WEBHOOK_SECRET;

interface CheckrWebhookEvent {
  id: string;
  object: 'event';
  type: string;
  created_at: string;
  account_id: string;
  data: {
    object: {
      id: string;
      object: string;
      status?: string;
      result?: string;
      adjudication?: string;
      completed_at?: string;
      [key: string]: unknown;
    };
  };
}

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('x-checkr-signature') || '';

  // Log webhook receipt for debugging
  console.log('[Checkr Webhook] Received event');

  // Verify signature
  if (CHECKR_WEBHOOK_SECRET) {
    if (!verifyWebhookSignature(payload, signature, CHECKR_WEBHOOK_SECRET)) {
      console.error('[Checkr Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[Checkr Webhook] No webhook secret configured in production — rejecting');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  } else {
    console.warn('[Checkr Webhook] No webhook secret configured, skipping verification in dev');
  }

  let event: CheckrWebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    console.error('[Checkr Webhook] Invalid JSON payload');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log(`[Checkr Webhook] Event type: ${event.type}, ID: ${event.id}`);

  // Handle different event types
  switch (event.type) {
    case 'report.created':
    case 'report.upgraded':
    case 'report.updated':
    case 'report.completed':
    case 'report.suspended':
    case 'report.disputed':
    case 'report.canceled':
    case 'report.pre_adverse_action':
    case 'report.post_adverse_action':
    case 'report.engaged':
      await handleReportEvent(event);
      break;

    case 'invitation.completed':
      await handleInvitationCompleted(event);
      break;

    case 'invitation.expired':
      await handleInvitationExpired(event);
      break;

    case 'candidate.created':
    case 'candidate.updated':
      // Candidates are created via invitations, so we can ignore these
      console.log(`[Checkr Webhook] Ignoring candidate event: ${event.type}`);
      break;

    default:
      console.log(`[Checkr Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle invitation.completed - candidate filled out their info, background check starting
 */
async function handleInvitationCompleted(event: CheckrWebhookEvent) {
  const invitationData = event.data.object;
  const invitationId = invitationData.id;
  const candidateId = invitationData.candidate_id as string | undefined;
  const reportIds = invitationData.report_ids as string[] | undefined;

  if (!invitationId) {
    console.error('[Checkr Webhook] No invitation ID in event');
    return;
  }

  // Find our background check record by invitation ID
  const backgroundCheck = await prisma.backgroundCheck.findUnique({
    where: { checkrInvitationId: invitationId },
  });

  if (!backgroundCheck) {
    console.log(`[Checkr Webhook] No background check found for invitation: ${invitationId}`);
    return;
  }

  // Update with candidate and report IDs from completed invitation
  const reportId = reportIds?.[0] || null;

  await prisma.backgroundCheck.update({
    where: { id: backgroundCheck.id },
    data: {
      checkrCandidateId: candidateId || null,
      checkrReportId: reportId,
      status: 'pending', // Changed from invitation_pending to pending
      updatedAt: new Date(),
    },
  });

  console.log(
    `[Checkr Webhook] Invitation completed: invitation=${invitationId}, candidate=${candidateId}, report=${reportId}`
  );
}

/**
 * Handle invitation.expired - candidate didn't complete the form in time
 */
async function handleInvitationExpired(event: CheckrWebhookEvent) {
  const invitationData = event.data.object;
  const invitationId = invitationData.id;

  if (!invitationId) {
    console.error('[Checkr Webhook] No invitation ID in event');
    return;
  }

  // Find our background check record by invitation ID
  const backgroundCheck = await prisma.backgroundCheck.findUnique({
    where: { checkrInvitationId: invitationId },
  });

  if (!backgroundCheck) {
    console.log(`[Checkr Webhook] No background check found for invitation: ${invitationId}`);
    return;
  }

  await prisma.backgroundCheck.update({
    where: { id: backgroundCheck.id },
    data: {
      status: 'invitation_expired',
      updatedAt: new Date(),
    },
  });

  console.log(`[Checkr Webhook] Invitation expired: ${invitationId}`);
}

async function handleReportEvent(event: CheckrWebhookEvent) {
  const reportData = event.data.object;
  const reportId = reportData.id;

  if (!reportId) {
    console.error('[Checkr Webhook] No report ID in event');
    return;
  }

  // Find our background check record
  const backgroundCheck = await prisma.backgroundCheck.findUnique({
    where: { checkrReportId: reportId },
  });

  if (!backgroundCheck) {
    console.log(`[Checkr Webhook] No background check found for report: ${reportId}`);
    return;
  }

  // Map Checkr status to our status
  const status = mapCheckrStatus(event.type, reportData.status);
  const result = reportData.result as string | null;
  const adjudication = reportData.adjudication as string | null;
  const completedAt = reportData.completed_at ? new Date(reportData.completed_at) : null;

  // Update our record
  await prisma.backgroundCheck.update({
    where: { id: backgroundCheck.id },
    data: {
      status,
      result,
      adjudication,
      completedAt,
      updatedAt: new Date(),
    },
  });

  console.log(
    `[Checkr Webhook] Updated background check ${backgroundCheck.id}: status=${status}, result=${result}`
  );

  // Send notification to recruiter when check completes
  if (status === 'complete' || status === 'suspended' || status === 'adverse_action') {
    await sendBackgroundCheckNotification(backgroundCheck.id, status, result);
  }
}

/**
 * Send email notification to recruiters when a background check status changes
 */
async function sendBackgroundCheckNotification(
  backgroundCheckId: string,
  status: string,
  result: string | null
) {
  try {
    // Fetch background check with candidate and application info
    const backgroundCheck = await prisma.backgroundCheck.findUnique({
      where: { id: backgroundCheckId },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            applications: {
              include: {
                job: {
                  include: {
                    hiringTeam: {
                      where: { role: { in: ['RECRUITER', 'HIRING_MANAGER'] } },
                      include: {
                        user: { select: { email: true, firstName: true } },
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!backgroundCheck?.candidate) {
      console.log('[Checkr Notification] No candidate found');
      return;
    }

    const candidate = backgroundCheck.candidate;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const latestApplication = candidate.applications[0];

    // Get recipient emails from hiring team or fallback to HQ admins
    let recipientEmails: string[] = [];

    if (latestApplication?.job?.hiringTeam) {
      recipientEmails = latestApplication.job.hiringTeam
        .map((ht) => ht.user.email)
        .filter((e): e is string => !!e);
    }

    // Fallback to HQ admins if no hiring team
    if (recipientEmails.length === 0) {
      const admins = await prisma.user.findMany({
        where: { role: 'HQ_ADMIN' },
        select: { email: true },
      });
      recipientEmails = admins.map((a) => a.email);
    }

    if (recipientEmails.length === 0) {
      console.log('[Checkr Notification] No recipients found');
      return;
    }

    // Determine email subject and content based on result
    let subject: string;
    let statusBadge: string;
    let statusMessage: string;
    let actionMessage: string;

    if (status === 'complete' && result === 'clear') {
      subject = `Background check cleared for ${candidateName}`;
      statusBadge = '<span style="display: inline-block; padding: 4px 12px; background-color: #d1fae5; color: #065f46; border-radius: 9999px; font-size: 14px; font-weight: 500;">Cleared</span>';
      statusMessage = 'The background check has completed and the candidate has a clear record.';
      actionMessage = 'You can proceed with sending an offer to this candidate.';
    } else if (status === 'complete' && result === 'consider') {
      subject = `Background check requires review for ${candidateName}`;
      statusBadge = '<span style="display: inline-block; padding: 4px 12px; background-color: #fef3c7; color: #92400e; border-radius: 9999px; font-size: 14px; font-weight: 500;">Review Required</span>';
      statusMessage = 'The background check has completed but requires manual review before proceeding.';
      actionMessage = 'Please review the results in Checkr before making a hiring decision.';
    } else if (status === 'suspended') {
      subject = `Background check suspended for ${candidateName}`;
      statusBadge = '<span style="display: inline-block; padding: 4px 12px; background-color: #fee2e2; color: #991b1b; border-radius: 9999px; font-size: 14px; font-weight: 500;">Suspended</span>';
      statusMessage = 'The background check has been suspended. This may require candidate action or additional information.';
      actionMessage = 'Please check Checkr for more details and next steps.';
    } else if (status === 'adverse_action') {
      subject = `Adverse action required for ${candidateName}`;
      statusBadge = '<span style="display: inline-block; padding: 4px 12px; background-color: #fee2e2; color: #991b1b; border-radius: 9999px; font-size: 14px; font-weight: 500;">Adverse Action</span>';
      statusMessage = 'The background check results may disqualify this candidate.';
      actionMessage = 'Follow FCRA-compliant adverse action procedures before making a final decision.';
    } else {
      subject = `Background check update for ${candidateName}`;
      statusBadge = `<span style="display: inline-block; padding: 4px 12px; background-color: #e5e7eb; color: #374151; border-radius: 9999px; font-size: 14px; font-weight: 500;">${status}</span>`;
      statusMessage = `The background check status has changed to: ${status}`;
      actionMessage = 'Please review the status in Hiring Hub for more details.';
    }

    // Build application link
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
    const applicationLink = latestApplication
      ? `${appBaseUrl}/applications/${latestApplication.id}`
      : `${appBaseUrl}/candidates`;

    const jobTitle = latestApplication?.job?.title || 'Unknown Position';

    const htmlContent = `
      <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 600; color: #1f2937;">
        Background Check Update
      </h2>

      <div style="margin-bottom: 24px;">
        ${statusBadge}
      </div>

      <table style="width: 100%; margin-bottom: 24px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #6b7280;">Candidate:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            ${candidateName}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #6b7280;">Position:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            ${jobTitle}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: #6b7280;">Package:</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            ${backgroundCheck.package.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 16px 0; color: #4b5563;">
        ${statusMessage}
      </p>

      <p style="margin: 0 0 24px 0; color: #4b5563;">
        ${actionMessage}
      </p>

      <div style="text-align: center;">
        <a href="${applicationLink}" style="display: inline-block; padding: 12px 24px; background-color: #6b46c1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View Candidate
        </a>
      </div>
    `;

    // Send to all recipients
    for (const email of recipientEmails) {
      try {
        await sendBrandedEmail({
          to: email,
          subject,
          htmlBody: htmlContent,
          preheader: statusMessage,
          from: 'RECRUITING',
        });
        console.log(`[Checkr Notification] Email sent to ${email}`);
      } catch (err) {
        console.error(`[Checkr Notification] Failed to send to ${email}:`, err);
      }
    }
  } catch (error) {
    console.error('[Checkr Notification] Error sending notification:', error);
  }
}

function mapCheckrStatus(eventType: string, checkrStatus?: string): string {
  switch (eventType) {
    case 'report.completed':
      return 'complete';
    case 'report.suspended':
      return 'suspended';
    case 'report.disputed':
      return 'disputed';
    case 'report.canceled':
      return 'canceled';
    case 'report.pre_adverse_action':
    case 'report.post_adverse_action':
      return 'adverse_action';
    case 'report.engaged':
      return 'complete'; // Engaged means we reviewed and accepted
    default:
      return checkrStatus || 'pending';
  }
}
