import { prisma } from '@/lib/prisma';
import { replaceMergeFields } from './merge-fields';

// Branded email wrapper (same as in email-templates.ts)
const BRAND = {
  blue: '#3BA9DA',
  purple: '#7C3AED',
  yellow: '#F5D547',
  coral: '#E8837B',
  darkBlue: '#2D3E6F',
  lightBlue: '#E5F4F8',
};

const LOGO_URL = 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024.png';

function brandedEmailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND.lightBlue};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.lightBlue}; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: ${BRAND.blue}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="Acme Talent" style="height: 60px; width: auto;">
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color: ${BRAND.purple}; padding: 25px 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #ffffff; font-size: 14px;">
                Acme Talent Recruiting Team
              </p>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">
                <a href="mailto:careers@acmetalent.com" style="color: #ffffff;">careers@acmetalent.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

type EmailTemplateType =
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_REJECTION'
  | 'AVAILABILITY_REQUEST'
  | 'INTERVIEW_CONFIRMATION'
  | 'INTERVIEW_REMINDER'
  | 'INTERVIEW_CANCELLATION'
  | 'INTERVIEW_RESCHEDULE'
  | 'SCHEDULING_LINK'
  | 'STAGE_CHANGE'
  | 'OFFER_EXTENDED'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'SCORECARD_REMINDER'
  | 'INTERVIEWER_INVITE'
  | 'REFERRAL_RECEIPT'
  | 'CUSTOM';

/**
 * Resolves an email template from the database (if a default exists),
 * otherwise falls back to the hardcoded template.
 *
 * @param type - The EmailTemplateType to look up
 * @param mergeData - Key-value pairs for merge field replacement
 * @param fallbackArgs - Arguments for the hardcoded fallback template function
 * @returns { subject, html } ready to send
 */
export async function resolveTemplate(
  type: EmailTemplateType,
  mergeData: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  try {
    // Look up the default template for this type in the database
    const dbTemplate = await prisma.emailTemplate.findFirst({
      where: {
        type,
        isDefault: true,
        // Could add scope filtering here later
      },
      select: {
        subject: true,
        body: true,
      },
    });

    if (dbTemplate) {
      const resolvedSubject = replaceMergeFields(dbTemplate.subject, mergeData);
      const resolvedBody = replaceMergeFields(dbTemplate.body, mergeData);
      return {
        subject: resolvedSubject,
        html: brandedEmailWrapper(resolvedBody),
      };
    }
  } catch (error) {
    console.error(`Failed to look up DB template for ${type}:`, error);
    // Fall through to hardcoded fallback
  }

  return null; // No DB template found, caller should use hardcoded fallback
}

/**
 * Build merge data from common application/candidate/job context.
 * Call this at each sending point with the data you have available.
 */
export function buildMergeData(context: {
  candidate?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  job?: {
    title?: string;
    location?: string;
  };
  market?: {
    name?: string;
  };
  stage?: {
    name?: string;
  };
  interview?: {
    type?: string;
    date?: string;
    time?: string;
    duration?: number;
    location?: string;
    meetingLink?: string;
    interviewerName?: string;
  };
  offer?: {
    salary?: string;
    startDate?: string;
    offerLink?: string;
  };
  scheduling?: {
    portalUrl?: string;
    schedulingLink?: string;
  };
  recruiter?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}): Record<string, string> {
  const data: Record<string, string> = {};
  const { candidate, job, market, stage, interview, offer, scheduling, recruiter } = context;

  if (candidate) {
    if (candidate.firstName) data['{{CANDIDATE_FIRST_NAME}}'] = candidate.firstName;
    if (candidate.lastName) data['{{CANDIDATE_LAST_NAME}}'] = candidate.lastName;
    if (candidate.firstName && candidate.lastName) {
      data['{{CANDIDATE_NAME}}'] = `${candidate.firstName} ${candidate.lastName}`;
      data['{{PREFERRED_FIRST_NAME}}'] = candidate.firstName;
      data['{{PREFERRED_FULL_NAME}}'] = `${candidate.firstName} ${candidate.lastName}`;
    }
    if (candidate.email) data['{{CANDIDATE_EMAIL_ADDRESS}}'] = candidate.email;
    if (candidate.phone) data['{{CANDIDATE_PHONE}}'] = candidate.phone;
  }

  if (job) {
    if (job.title) data['{{JOB_NAME}}'] = job.title;
    if (job.location) data['{{JOB_LOCATION}}'] = job.location;
  }

  if (market?.name) data['{{OFFICE}}'] = market.name;

  if (stage?.name) data['{{STAGE_NAME}}'] = stage.name;

  data['{{COMPANY}}'] = 'Acme Talent';
  data['{{COMPANY_CAREERS_URL}}'] = 'https://hiring.acmetalent.com/careers';
  data['{{TODAY_DATE}}'] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (interview) {
    if (interview.type) data['{{INTERVIEW_TYPE}}'] = interview.type;
    if (interview.date) data['{{INTERVIEW_DATE}}'] = interview.date;
    if (interview.time) data['{{INTERVIEW_TIME}}'] = interview.time;
    if (interview.duration) data['{{INTERVIEW_DURATION}}'] = `${interview.duration} minutes`;
    if (interview.location) data['{{INTERVIEW_LOCATION}}'] = interview.location;
    if (interview.meetingLink) data['{{MEETING_LINK}}'] = interview.meetingLink;
    if (interview.interviewerName) data['{{INTERVIEWER_NAME}}'] = interview.interviewerName;
  }

  if (offer) {
    if (offer.salary) data['{{SALARY}}'] = offer.salary;
    if (offer.startDate) data['{{START_DATE}}'] = offer.startDate;
    if (offer.offerLink) data['{{OFFER_LINK}}'] = offer.offerLink;
  }

  if (scheduling) {
    if (scheduling.portalUrl) data['{{AVAILABILITY_SUBMISSION_LINK}}'] = scheduling.portalUrl;
    if (scheduling.schedulingLink) data['{{SCHEDULING_LINK}}'] = scheduling.schedulingLink;
  }

  if (recruiter) {
    if (recruiter.firstName) data['{{MY_FIRST_NAME}}'] = recruiter.firstName;
    if (recruiter.firstName && recruiter.lastName) {
      data['{{MY_FULL_NAME}}'] = `${recruiter.firstName} ${recruiter.lastName}`;
      data['{{RECRUITER}}'] = `${recruiter.firstName} ${recruiter.lastName}`;
      data['{{MY_SIGNATURE}}'] = `${recruiter.firstName} ${recruiter.lastName}`;
    }
    if (recruiter.email) data['{{MY_EMAIL_ADDRESS}}'] = recruiter.email;
  }

  return data;
}
