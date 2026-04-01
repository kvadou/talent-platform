import { ServerClient } from 'postmark';

const apiKey = process.env.POSTMARK_API_KEY;

export const postmarkClient = apiKey ? new ServerClient(apiKey) : null;

// Sender addresses for different phases
export const SENDER_ADDRESSES = {
  RECRUITING: 'Acme Talent Recruiting <recruiting@acmetalent.com>',
  ONBOARDING: 'Acme Talent Onboarding <onboarding@acmetalent.com>',
  DEFAULT: process.env.POSTMARK_FROM_EMAIL ?? 'noreply@acmetalent.com',
} as const;

export type SenderType = keyof typeof SENDER_ADDRESSES;

export type EmailPayload = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  messageStream?: string;
  from?: SenderType;
};

// Brand colors
const BRAND_COLORS = {
  primary: '#6b46c1',      // Purple
  primaryDark: '#553c9a',
  secondary: '#f6ad55',    // Orange/Gold
  background: '#f7fafc',
  text: '#2d3748',
  textLight: '#718096',
  border: '#e2e8f0',
};

// Logo URL - using Webflow CDN (500px version for optimal email loading)
const LOGO_URL = 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024-p-500.png';

// Branded email wrapper
export function wrapEmailWithBranding(content: string, options?: {
  preheader?: string;
  showFooter?: boolean;
}): string {
  const { preheader = '', showFooter = true } = options || {};

  const footer = showFooter ? `
    <tr>
      <td style="padding: 20px 40px; background-color: ${BRAND_COLORS.background}; border-top: 1px solid ${BRAND_COLORS.border};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: ${BRAND_COLORS.textLight};">
                Acme Talent
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">
                <a href="https://acmetalent.com/careers" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">acmetalent.com/careers</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: ${BRAND_COLORS.textLight};">
                <a href="mailto:recruiting+unsubscribe@acmetalent.com?subject=Unsubscribe" style="color: ${BRAND_COLORS.textLight}; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Acme Talent</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { padding: 0; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BRAND_COLORS.background}; color: ${BRAND_COLORS.text};">
  ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${BRAND_COLORS.primary}; border-radius: 8px 8px 0 0; text-align: center;">
              <img src="${LOGO_URL}" alt="Acme Talent" width="120" height="auto" style="display: block; margin: 0 auto 15px auto; max-width: 120px;" />
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">
                Acme Talent Recruiting
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px; background-color: #ffffff; border-left: 1px solid ${BRAND_COLORS.border}; border-right: 1px solid ${BRAND_COLORS.border};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size: 16px; line-height: 1.6; color: ${BRAND_COLORS.text};">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          ${footer}

          <!-- Bottom border radius -->
          <tr>
            <td style="height: 8px; background-color: ${BRAND_COLORS.primary}; border-radius: 0 0 8px 8px;"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendEmail(payload: EmailPayload) {
  if (!postmarkClient) {
    console.log(`[Postmark Stub] Would send email to ${payload.to}: "${payload.subject}" — set POSTMARK_API_KEY to send real emails`);
    return { MessageID: 'mock-message-id', SubmittedAt: new Date().toISOString(), To: payload.to };
  }

  const fromAddress = payload.from
    ? SENDER_ADDRESSES[payload.from]
    : SENDER_ADDRESSES.DEFAULT;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

  return postmarkClient.sendEmail({
    From: fromAddress,
    To: payload.to,
    Subject: payload.subject,
    HtmlBody: payload.htmlBody,
    TextBody: payload.textBody,
    MessageStream: payload.messageStream ?? 'outbound',
    Headers: [
      {
        Name: 'List-Unsubscribe',
        Value: `<mailto:recruiting+unsubscribe@acmetalent.com?subject=Unsubscribe>, <${appUrl}/unsubscribe?email=${encodeURIComponent(payload.to)}>`,
      },
      {
        Name: 'List-Unsubscribe-Post',
        Value: 'List-Unsubscribe=One-Click',
      },
    ],
  });
}

// Send branded email (wraps content with branding)
export async function sendBrandedEmail(payload: EmailPayload & { preheader?: string }) {
  const brandedHtml = wrapEmailWithBranding(payload.htmlBody, {
    preheader: payload.preheader
  });

  return sendEmail({
    ...payload,
    htmlBody: brandedHtml,
  });
}
