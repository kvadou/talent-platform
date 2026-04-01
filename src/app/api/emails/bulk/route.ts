import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { postmarkClient, wrapEmailWithBranding, SENDER_ADDRESSES } from '@/lib/postmark';
import { getUserMarkets } from '@/lib/market-scope';
import { generateToken, hashToken, applicationTokenExpiresAt } from '@/lib/tokens';
import { z } from 'zod';

const attachmentSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  content: z.string(), // base64 encoded
});

const bulkEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  candidateIds: z.array(z.string()).min(1, 'At least one recipient required').max(100, 'Maximum 100 recipients'),
  // Optional: specify which application to log the message against
  applicationIds: z.array(z.string()).optional(),
  // Optional: override the from address (defaults to RECRUITING)
  fromAddress: z.enum(['RECRUITING', 'ONBOARDING']).optional(),
  // Optional: CC addresses
  cc: z.array(z.string().email()).optional(),
  // Optional: file attachments
  attachments: z.array(attachmentSchema).optional(),
});

const BATCH_SIZE = 50;

// Merge field replacements for a candidate
// Supports both UPPERCASE (template editor) and lowercase (legacy) formats
function applyMergeFields(template: string, data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  jobLocation?: string;
  stageName?: string;
  senderFirstName?: string;
  senderFullName?: string;
  senderEmail?: string;
  statusUrl?: string;
}): string {
  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const statusUrl = data.statusUrl || '#';
  const signature = data.senderFullName || data.senderFirstName || '';

  return template
    // UPPERCASE format (standard - from template editor)
    .replace(/\{\{CANDIDATE_FIRST_NAME\}\}/g, data.firstName || '')
    .replace(/\{\{CANDIDATE_LAST_NAME\}\}/g, data.lastName || '')
    .replace(/\{\{CANDIDATE_NAME\}\}/g, fullName)
    .replace(/\{\{CANDIDATE_EMAIL_ADDRESS\}\}/g, data.email || '')
    .replace(/\{\{CANDIDATE_PHONE\}\}/g, data.phone || '')
    .replace(/\{\{PREFERRED_FIRST_NAME\}\}/g, data.firstName || '')
    .replace(/\{\{PREFERRED_FULL_NAME\}\}/g, fullName)
    .replace(/\{\{JOB_NAME\}\}/g, data.jobTitle || '')
    .replace(/\{\{JOB_LOCATION\}\}/g, data.jobLocation || '')
    .replace(/\{\{OFFICE\}\}/g, data.jobLocation || '')
    .replace(/\{\{STAGE_NAME\}\}/g, data.stageName || '')
    .replace(/\{\{COMPANY\}\}/g, 'Acme Talent')
    .replace(/\{\{COMPANY_CAREERS_URL\}\}/g, 'https://hiring.acmetalent.com/careers')
    .replace(/\{\{MY_FIRST_NAME\}\}/g, data.senderFirstName || '')
    .replace(/\{\{MY_FULL_NAME\}\}/g, data.senderFullName || '')
    .replace(/\{\{MY_EMAIL_ADDRESS\}\}/g, data.senderEmail || '')
    .replace(/\{\{MY_SIGNATURE\}\}/g, signature)
    .replace(/\{\{MY_JOB_TITLE\}\}/g, '')
    .replace(/\{\{RECRUITER\}\}/g, data.senderFullName || '')
    .replace(/\{\{COORDINATOR\}\}/g, data.senderFullName || '')
    .replace(/\{\{TODAY_DATE\}\}/g, today)
    .replace(/\{\{AVAILABILITY_SUBMISSION_LINK\}\}/g, statusUrl)
    .replace(/\{\{SCHEDULING_LINK\}\}/g, statusUrl)
    .replace(/\{\{CALENDAR_LINK\}\}/g, statusUrl)
    // lowercase format (legacy - backwards compatibility)
    .replace(/\{\{first_name\}\}/g, data.firstName || '')
    .replace(/\{\{last_name\}\}/g, data.lastName || '')
    .replace(/\{\{full_name\}\}/g, fullName)
    .replace(/\{\{job_title\}\}/g, data.jobTitle || '')
    .replace(/\{\{company\}\}/g, 'Acme Talent');
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  // Parse and validate request
  const rawBody = await req.json();
  const parseResult = bulkEmailSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { subject, body, candidateIds, fromAddress, cc, attachments } = parseResult.data;

  // Get the sender address
  const senderAddress = fromAddress ? SENDER_ADDRESSES[fromAddress] : SENDER_ADDRESSES.RECRUITING;

  // Build CC string
  const ccString = cc && cc.length > 0 ? cc.join(',') : undefined;

  // Format attachments for Postmark
  const postmarkAttachments = attachments?.map((a) => ({
    Name: a.name,
    Content: a.content,
    ContentType: a.type,
    ContentID: '',
  }));

  // Check Postmark is configured
  if (!postmarkClient) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  // Get current user info for sender merge fields
  const currentUser = await prisma.user.findFirst({
    where: { email: session.user.email },
    select: { firstName: true, lastName: true, email: true }
  });
  const senderFirstName = currentUser?.firstName || '';
  const senderFullName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';
  const senderEmail = currentUser?.email || '';

  // Fetch candidates with their most recent active application
  const candidates = await prisma.candidate.findMany({
    where: {
      id: { in: candidateIds },
      // Market access check: candidate must have at least one application in accessible markets
      ...(access.marketIds ? {
        applications: {
          some: {
            job: { marketId: { in: access.marketIds } }
          }
        }
      } : {})
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      applications: {
        where: {
          status: 'ACTIVE',
          ...(access.marketIds ? { job: { marketId: { in: access.marketIds } } } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          job: {
            select: {
              title: true,
              market: { select: { name: true } }
            }
          },
          stage: { select: { name: true } }
        }
      }
    }
  });

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No valid recipients found' }, { status: 400 });
  }

  // Generate status page URLs for candidates with applications
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';
  const applicationIds = candidates
    .map((c) => c.applications[0]?.id)
    .filter((id): id is string => !!id);

  // Generate additional tokens for each application so we can build status URLs
  // Uses create (not upsert) so existing tokens remain valid
  const tokenMap = new Map<string, string>();
  for (const appId of applicationIds) {
    const rawToken = generateToken();
    await prisma.applicationToken.create({
      data: {
        applicationId: appId,
        token: hashToken(rawToken),
        expiresAt: applicationTokenExpiresAt(),
      },
    });
    tokenMap.set(appId, rawToken);
  }

  // Prepare emails for each candidate
  const emailsToSend: Array<{
    candidateId: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    applicationId: string | null;
    personalizedSubject: string;
    personalizedBody: string;
  }> = candidates.map((candidate) => {
    const app = candidate.applications[0];
    const jobTitle = app?.job?.title || '';
    const jobLocation = app?.job?.market?.name || '';
    const stageName = app?.stage?.name || '';
    const rawToken = app?.id ? tokenMap.get(app.id) : undefined;
    const statusUrl = rawToken ? `${baseUrl}/status/${rawToken}` : '';

    const mergeData = {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone || '',
      jobTitle,
      jobLocation,
      stageName,
      senderFirstName,
      senderFullName,
      senderEmail,
      statusUrl,
    };

    return {
      candidateId: candidate.id,
      email: candidate.email,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      jobTitle,
      applicationId: app?.id || null,
      personalizedSubject: applyMergeFields(subject, mergeData),
      personalizedBody: applyMergeFields(body, mergeData),
    };
  });

  // Send in batches
  const results: Array<{ email: string; success: boolean; error?: string; messageId?: string }> = [];

  for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
    const batch = emailsToSend.slice(i, i + BATCH_SIZE);

    // Prepare batch for Postmark
    const messages = batch.map((item) => ({
      From: senderAddress,
      To: item.email,
      Cc: ccString,
      Subject: item.personalizedSubject,
      HtmlBody: wrapEmailWithBranding(item.personalizedBody),
      TextBody: item.personalizedBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      MessageStream: 'outbound',
      Attachments: postmarkAttachments,
    }));

    try {
      const batchResult = await postmarkClient.sendEmailBatch(messages);

      // Process results
      for (let j = 0; j < batchResult.length; j++) {
        const result = batchResult[j];
        const emailItem = batch[j];

        if (result.ErrorCode === 0) {
          results.push({
            email: emailItem.email,
            success: true,
            messageId: result.MessageID,
          });

          // Log to MessageLog if we have an applicationId
          if (emailItem.applicationId) {
            try {
              await prisma.messageLog.create({
                data: {
                  applicationId: emailItem.applicationId,
                  type: 'EMAIL',
                  recipient: emailItem.email,
                  subject: emailItem.personalizedSubject,
                  body: emailItem.personalizedBody,
                  status: 'SENT',
                  postmarkMessageId: result.MessageID,
                },
              });
            } catch (logError) {
              console.error('Failed to log message:', logError);
            }
          }
        } else {
          results.push({
            email: emailItem.email,
            success: false,
            error: result.Message || 'Failed to send',
          });
        }
      }
    } catch (error) {
      // Entire batch failed
      for (const emailItem of batch) {
        results.push({
          email: emailItem.email,
          success: false,
          error: error instanceof Error ? error.message : 'Batch send failed',
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    summary: {
      total: results.length,
      sent: successCount,
      failed: failCount,
    },
    results,
  });
}
