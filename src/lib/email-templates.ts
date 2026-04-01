// Default timezone for email notifications when none is provided
const DEFAULT_EMAIL_TIMEZONE = 'America/New_York';

function formatDateInTimezone(dateStr: string, timezone?: string): string {
  const tz = timezone || DEFAULT_EMAIL_TIMEZONE;
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
}

// Brand Colors
const BRAND = {
  blue: '#3BA9DA',
  purple: '#7C3AED',
  yellow: '#F5D547',
  coral: '#E8837B',
  darkBlue: '#2D3E6F',
  lightBlue: '#E5F4F8',
};

const LOGO_URL = 'https://placehold.co/200x60/3BA9DA/white?text=Acme+Talent';

// Branded email wrapper
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
          <!-- Header with logo -->
          <tr>
            <td style="background-color: ${BRAND.blue}; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="Acme Talent" style="height: 60px; width: auto;">
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
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

export function applicationReceivedTemplate(candidateName: string, jobTitle: string, portalUrl?: string) {
  const trackingSection = portalUrl
    ? `
      <div style="margin-top: 30px; padding: 20px; background-color: ${BRAND.lightBlue}; border-radius: 8px; border-left: 4px solid ${BRAND.blue};">
        <p style="margin: 0 0 10px; font-weight: 600; color: ${BRAND.darkBlue};">Track Your Application</p>
        <p style="margin: 0 0 10px; font-size: 14px; color: #666;">You can check your application status anytime:</p>
        <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${BRAND.blue}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Application Status</a>
      </div>
    `
    : '';

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Thanks for applying!</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Thanks for applying to <strong style="color: ${BRAND.darkBlue};">${jobTitle}</strong> at Acme Talent!
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Our team will review your application and follow up soon. We typically respond within a few business days.
    </p>
    ${trackingSection}
    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      Warmly,<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: `Thanks for applying for ${jobTitle}!`,
    html: brandedEmailWrapper(content)
  };
}

export function newApplicationNotification(jobTitle: string) {
  return {
    subject: `New application for ${jobTitle}`,
    html: `<p>A new application has been submitted for <strong>${jobTitle}</strong>.</p>`
  };
}

export function stageMovedTemplate(candidateName: string, stageName: string) {
  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Application Update</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Great news! Your application has been moved to <strong style="color: ${BRAND.blue};">${stageName}</strong>.
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      We'll be in touch with next steps soon.
    </p>
    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      Best regards,<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: `Your application moved to ${stageName}`,
    html: brandedEmailWrapper(content)
  };
}

export function interviewScheduledTemplate(candidateName: string, scheduledAt: string, location?: string, meetingLink?: string, timezone?: string) {
  let locationInfo = '';
  if (meetingLink) {
    locationInfo = `<p style="margin: 10px 0; font-size: 16px; color: #333;">Join the meeting: <a href="${meetingLink}" style="color: ${BRAND.blue};">${meetingLink}</a></p>`;
  } else if (location) {
    locationInfo = `<p style="margin: 10px 0; font-size: 16px; color: #333;">Location: <strong>${location}</strong></p>`;
  }

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Interview Scheduled!</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Your interview has been scheduled for <strong style="color: ${BRAND.darkBlue};">${scheduledAt}</strong>.
    </p>
    ${locationInfo}
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      We look forward to speaking with you!
    </p>
    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      Best regards,<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: `Interview scheduled - ${scheduledAt}`,
    html: brandedEmailWrapper(content)
  };
}

export function hireTemplate(candidateName: string) {
  const content = `
    <h1 style="margin: 0 0 20px; font-size: 28px; color: ${BRAND.darkBlue};">Welcome to Acme Talent!</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 15px; font-size: 18px; color: ${BRAND.blue}; font-weight: 500; line-height: 1.6;">
      Congratulations! We're thrilled to have you join our team!
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Our team will share onboarding details with you shortly.
    </p>
    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      We're excited to work with you!<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Team</span>
    </p>
  `;

  return {
    subject: 'Welcome to Acme Talent!',
    html: brandedEmailWrapper(content)
  };
}

export function rejectTemplate(candidateName: string) {
  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Update on Your Application</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Thank you for your interest in Acme Talent and for taking the time to apply.
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      After careful consideration, we will not be moving forward with your application at this time. We encourage you to apply for future positions that match your skills.
    </p>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      We appreciate your time and wish you all the best in your job search.
    </p>
    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      Best regards,<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: 'Update on your application',
    html: brandedEmailWrapper(content)
  };
}

export function interviewConfirmationTemplate(
  candidateName: string,
  interviewType: string,
  scheduledAt: string,
  duration: number,
  location?: string,
  meetingLink?: string,
  interviewerName?: string,
  timezone?: string
) {
  const formattedDate = formatDateInTimezone(scheduledAt, timezone);

  let locationInfo = '';
  if (meetingLink) {
    locationInfo = `<p style="margin: 8px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: ${BRAND.blue};">${meetingLink}</a></p>`;
  } else if (location) {
    locationInfo = `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>`;
  }

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Interview Confirmed</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
      This email confirms your upcoming interview with Acme Talent.
    </p>

    <div style="background-color: ${BRAND.lightBlue}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${BRAND.blue};">
      <p style="margin: 8px 0;"><strong>Interview Type:</strong> ${interviewType}</p>
      <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
      <p style="margin: 8px 0;"><strong>Duration:</strong> ${duration} minutes</p>
      ${interviewerName ? `<p style="margin: 8px 0;"><strong>Interviewer:</strong> ${interviewerName}</p>` : ''}
      ${locationInfo}
    </div>

    ${meetingLink ? `
      <p style="margin: 20px 0;">
        <a href="${meetingLink}" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND.blue}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Video Call</a>
      </p>
    ` : ''}

    <p style="margin: 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Please reply to this email if you need to reschedule or have any questions.
    </p>

    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      We look forward to speaking with you!<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: `Interview Confirmed - ${interviewType} on ${formattedDate}`,
    html: content
  };
}

export function interviewReminderTemplate(
  candidateName: string,
  interviewType: string,
  scheduledAt: string,
  duration: number,
  hoursUntil: number,
  location?: string,
  meetingLink?: string,
  timezone?: string
) {
  const formattedDate = formatDateInTimezone(scheduledAt, timezone);

  let locationInfo = '';
  if (meetingLink) {
    locationInfo = `<p style="margin: 8px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: ${BRAND.blue};">${meetingLink}</a></p>`;
  } else if (location) {
    locationInfo = `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>`;
  }

  const reminderText = hoursUntil === 24
    ? 'This is a reminder that your interview is scheduled for tomorrow.'
    : 'This is a reminder that your interview starts in 1 hour.';

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">Interview Reminder</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
      ${reminderText}
    </p>

    <div style="background-color: ${BRAND.lightBlue}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${BRAND.blue};">
      <p style="margin: 8px 0;"><strong>Interview Type:</strong> ${interviewType}</p>
      <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
      <p style="margin: 8px 0;"><strong>Duration:</strong> ${duration} minutes</p>
      ${locationInfo}
    </div>

    ${meetingLink ? `
      <p style="margin: 20px 0;">
        <a href="${meetingLink}" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND.blue}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Video Call</a>
      </p>
    ` : ''}

    <p style="margin: 15px 0; font-size: 16px; color: #333; line-height: 1.6;">
      Please reply to this email if you have any questions or need to reschedule.
    </p>

    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      Best regards,<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Recruiting Team</span>
    </p>
  `;

  return {
    subject: `Interview Reminder - ${interviewType} ${hoursUntil === 24 ? 'Tomorrow' : 'in 1 Hour'}`,
    html: brandedEmailWrapper(content)
  };
}

export function highMatchCandidateAlert(
  candidateName: string,
  candidateEmail: string,
  jobTitle: string,
  matchScore: number,
  applicationUrl: string,
  matchedKeywords?: string[]
) {
  const keywordsSection = matchedKeywords && matchedKeywords.length > 0
    ? `<p style="margin: 8px 0;"><strong>Matched Keywords:</strong> ${matchedKeywords.join(', ')}</p>`
    : '';

  const scoreColor = matchScore >= 90 ? '#22c55e' : matchScore >= 80 ? '#84cc16' : '#eab308';

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 24px; color: ${BRAND.darkBlue};">High Match Candidate Alert</h1>
    <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
      A strong candidate just applied!
    </p>

    <div style="background-color: ${BRAND.lightBlue}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${BRAND.blue};">
      <p style="margin: 8px 0;"><strong>Candidate:</strong> ${candidateName}</p>
      <p style="margin: 8px 0;"><strong>Email:</strong> ${candidateEmail}</p>
      <p style="margin: 8px 0;"><strong>Position:</strong> ${jobTitle}</p>
      <p style="margin: 8px 0;"><strong>Match Score:</strong> <span style="color: ${scoreColor}; font-size: 24px; font-weight: bold;">${matchScore}%</span></p>
      ${keywordsSection}
    </div>

    <p style="margin: 20px 0;">
      <a href="${applicationUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${BRAND.purple}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Application</a>
    </p>

    <p style="margin: 20px 0 0; font-size: 12px; color: #666;">
      This alert was triggered because the candidate scored above 80% based on your job matching keywords.
    </p>
  `;

  return {
    subject: `High Match (${matchScore}%): ${candidateName} for ${jobTitle}`,
    html: brandedEmailWrapper(content)
  };
}

export function offerLetterTemplate(
  candidateName: string,
  jobTitle: string,
  salary: number,
  startDate: string,
  offerLink: string
) {
  const formattedSalary = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(salary);

  const formattedDate = new Date(startDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h1 style="margin: 0 0 20px; font-size: 28px; color: ${BRAND.darkBlue};">Congratulations!</h1>
    <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">
      Hi ${candidateName},
    </p>
    <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">
      We are thrilled to extend you an offer to join Acme Talent as a <strong style="color: ${BRAND.darkBlue};">${jobTitle}</strong>!
    </p>

    <div style="background-color: ${BRAND.lightBlue}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${BRAND.blue};">
      <p style="margin: 8px 0;"><strong>Position:</strong> ${jobTitle}</p>
      <p style="margin: 8px 0;"><strong>Annual Salary:</strong> ${formattedSalary}</p>
      <p style="margin: 8px 0;"><strong>Proposed Start Date:</strong> ${formattedDate}</p>
    </div>

    <p style="margin: 20px 0; font-size: 16px; color: #333;">Please review the full offer letter and sign to accept:</p>

    <p style="margin: 20px 0;">
      <a href="${offerLink}" style="display: inline-block; padding: 16px 32px; background-color: #22c55e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View & Sign Offer Letter</a>
    </p>

    <p style="margin: 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
      If you have any questions, please don't hesitate to reach out.
    </p>

    <p style="margin: 30px 0 0; font-size: 16px; color: #333;">
      We're excited about you joining our team!<br/>
      <span style="color: ${BRAND.darkBlue}; font-weight: 500;">Acme Talent Team</span>
    </p>
  `;

  return {
    subject: `Job Offer - ${jobTitle} at Acme Talent`,
    html: brandedEmailWrapper(content)
  };
}
