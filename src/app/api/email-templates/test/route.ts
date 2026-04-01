import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendBrandedEmail } from '@/lib/postmark';
import { replaceMergeFields } from '@/lib/email-templates/merge-fields';

// Sample data so test emails look realistic
const TEST_MERGE_DATA: Record<string, string> = {
  '{{CANDIDATE_FIRST_NAME}}': 'Jane',
  '{{CANDIDATE_LAST_NAME}}': 'Smith',
  '{{CANDIDATE_NAME}}': 'Jane Smith',
  '{{CANDIDATE_EMAIL_ADDRESS}}': 'jane.smith@example.com',
  '{{CANDIDATE_PHONE}}': '(555) 123-4567',
  '{{PREFERRED_FIRST_NAME}}': 'Jane',
  '{{PREFERRED_FULL_NAME}}': 'Jane Smith',
  '{{JOB_NAME}}': 'Chess Tutor',
  '{{JOB_LOCATION}}': 'Austin, TX',
  '{{OFFICE}}': 'Austin',
  '{{COMPANY}}': 'Acme Talent',
  '{{COMPANY_CAREERS_URL}}': 'https://hiring.acmetalent.com/careers',
  '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  '{{STAGE_NAME}}': 'Phone Screen',
  '{{AVAILABILITY_SUBMISSION_LINK}}': 'https://hiring.acmetalent.com/status/example-token',
  '{{SCHEDULING_LINK}}': 'https://hiring.acmetalent.com/status/example-token',
  '{{INTERVIEW_DATE}}': 'March 15, 2026',
  '{{INTERVIEW_TIME}}': '2:00 PM CST',
  '{{INTERVIEW_DURATION}}': '30 minutes',
  '{{INTERVIEW_LOCATION}}': 'Zoom (link will be provided)',
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subject, body, to } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Fill in sender fields from the logged-in user
  const senderName = session.user.name || 'Recruiter';
  const senderFirst = senderName.split(' ')[0];
  const testData: Record<string, string> = {
    ...TEST_MERGE_DATA,
    '{{MY_EMAIL_ADDRESS}}': session.user.email,
    '{{MY_FIRST_NAME}}': senderFirst,
    '{{MY_FULL_NAME}}': senderName,
    '{{MY_SIGNATURE}}': senderName,
    '{{RECRUITER}}': senderName,
    '{{COORDINATOR}}': senderName,
  };

  const resolvedSubject = replaceMergeFields(`[TEST] ${subject}`, testData);
  const resolvedBody = replaceMergeFields(body, testData);

  try {
    await sendBrandedEmail({
      to,
      subject: resolvedSubject,
      htmlBody: resolvedBody,
      from: 'RECRUITING',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send test email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
