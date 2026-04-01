import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

type NewApplicantInfo = {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  source: string;
  resumeUrl?: string | null;
};

/**
 * Send notifications when a new candidate applies.
 * - Email: Sends to recipients configured in JobNotificationConfig (NEW_APPLICANT)
 * - Slack: Posts to webhook URL if SLACK_WEBHOOK_URL env var is set
 */
export async function notifyNewApplicant(info: NewApplicantInfo): Promise<void> {
  await Promise.allSettled([
    sendEmailNotifications(info),
    sendSlackNotification(info),
  ]);
}

async function sendEmailNotifications(info: NewApplicantInfo): Promise<void> {
  try {
    const config = await prisma.jobNotificationConfig.findUnique({
      where: {
        jobId_type: { jobId: info.jobId, type: 'NEW_APPLICANT' },
      },
    });

    if (!config?.isEnabled || !config.recipients.length) return;

    // Resolve recipients — can be user IDs or role strings like "hiring_managers"
    const emails = await resolveRecipientEmails(config.recipients, info.jobId);
    if (!emails.length) return;

    const appUrl = `${APP_URL}/applications/${info.applicationId}`;

    const subject = `New Applicant: ${info.candidateName} — ${info.jobTitle}`;
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px;">
        <h2 style="margin: 0 0 16px; color: #2D3E6F;">New Application Received</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 0; color: #666; width: 100px;">Candidate</td><td style="padding: 8px 0; font-weight: 600;">${info.candidateName}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${info.candidateEmail}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Job</td><td style="padding: 8px 0; font-weight: 600;">${info.jobTitle}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Source</td><td style="padding: 8px 0;">${formatSource(info.source)}</td></tr>
        </table>
        <a href="${appUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7C3AED; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View Application
        </a>
      </div>
    `;

    await Promise.allSettled(
      emails.map((to) =>
        sendEmail({ to, subject, htmlBody })
      )
    );
  } catch (err) {
    console.error('[NewApplicantNotify] Email notification failed:', err);
  }
}

async function sendSlackNotification(info: NewApplicantInfo): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    const appUrl = `${APP_URL}/applications/${info.applicationId}`;

    const payload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📋 New Application', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Candidate:*\n${info.candidateName}` },
            { type: 'mrkdwn', text: `*Job:*\n${info.jobTitle}` },
            { type: 'mrkdwn', text: `*Email:*\n${info.candidateEmail}` },
            { type: 'mrkdwn', text: `*Source:*\n${formatSource(info.source)}` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Application', emoji: true },
              url: appUrl,
              style: 'primary',
            },
          ],
        },
      ],
    };

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[NewApplicantNotify] Slack webhook failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[NewApplicantNotify] Slack notification failed:', err);
  }
}

async function resolveRecipientEmails(recipients: string[], jobId: string): Promise<string[]> {
  const emails: string[] = [];
  const userIds: string[] = [];

  for (const r of recipients) {
    if (r.includes('@')) {
      emails.push(r);
    } else if (r === 'hiring_managers' || r === 'recruiters' || r === 'coordinators') {
      // Role-based: look up from hiring team
      const roleMap: Record<string, string> = {
        hiring_managers: 'HIRING_MANAGER',
        recruiters: 'RECRUITER',
        coordinators: 'COORDINATOR',
      };
      const teamMembers = await prisma.hiringTeamMember.findMany({
        where: { jobId, role: roleMap[r] },
        select: { user: { select: { email: true } } },
      });
      emails.push(...teamMembers.map((m) => m.user.email));
    } else {
      // Assume it's a user ID
      userIds.push(r);
    }
  }

  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });
    emails.push(...users.map((u) => u.email));
  }

  // Deduplicate
  return [...new Set(emails)];
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    CAREER_PAGE: 'Career Page',
    INDEED: 'Indeed',
    LINKEDIN: 'LinkedIn',
    GOOGLE: 'Google',
    FACEBOOK: 'Facebook',
    GLASSDOOR: 'Glassdoor',
    ZIPRECRUITER: 'ZipRecruiter',
    REFERRAL: 'Referral',
  };
  return map[source] || source;
}
