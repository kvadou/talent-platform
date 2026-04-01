import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { wrapEmailWithBranding } from '@/lib/postmark';
import { replaceMergeFields } from '@/lib/email-templates/merge-fields';

// Sample data for preview rendering
const PREVIEW_MERGE_DATA: Record<string, string> = {
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
  '{{AVAILABILITY_SUBMISSION_LINK}}': '#',
  '{{SCHEDULING_LINK}}': '#',
  '{{CALENDAR_LINK}}': '#',
  '{{INTERVIEW_DATE}}': 'March 15, 2026',
  '{{INTERVIEW_TIME}}': '2:00 PM CST',
  '{{INTERVIEW_DURATION}}': '30 minutes',
  '{{INTERVIEW_LOCATION}}': 'Zoom',
  '{{INTERVIEWER_NAME}}': 'Admin User',
  '{{MY_EMAIL_ADDRESS}}': 'recruiting@acmetalent.com',
  '{{MY_FIRST_NAME}}': 'Doug',
  '{{MY_FULL_NAME}}': 'Admin User',
  '{{MY_JOB_TITLE}}': 'Recruiter',
  '{{MY_SIGNATURE}}': 'Admin User',
  '{{RECRUITER}}': 'Admin User',
  '{{COORDINATOR}}': 'Admin User',
  '{{APPLICATION_ID}}': 'APP-12345',
  '{{CANDIDATE_ID}}': 'CAN-67890',
  '{{APPLIED_DATE}}': 'March 1, 2026',
  '{{SOURCE}}': 'Career Page',
  '{{SALARY}}': '$25/hr',
  '{{SALARY_FREQUENCY}}': 'hourly',
  '{{HOURLY_RATE}}': '$25',
  '{{START_DATE}}': 'April 1, 2026',
  '{{EXPIRATION}}': 'March 20, 2026',
  '{{SIGN_ON_BONUS}}': '$0',
  '{{HIRING_MANAGER}}': 'Admin User',
  '{{OFFER_LINK}}': '#',
};

// POST - Generate branded email preview HTML
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subject, body } = await req.json();

  if (!body) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const resolvedSubject = subject ? replaceMergeFields(subject, PREVIEW_MERGE_DATA) : '';
  const resolvedBody = replaceMergeFields(body, PREVIEW_MERGE_DATA);
  const brandedHtml = wrapEmailWithBranding(resolvedBody);

  return NextResponse.json({ html: brandedHtml, subject: resolvedSubject });
}
