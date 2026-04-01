import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/postmark';
import { prisma } from '@/lib/prisma';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { to, subject, htmlBody, textBody, applicationId } = await req.json();
  if (applicationId && !(await canAccessApplication(auth.email, applicationId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sendResult = await sendEmail({ to, subject, htmlBody, textBody });
  if (applicationId) {
    await prisma.messageLog.create({
      data: { applicationId, type: 'EMAIL', recipient: to, subject, body: htmlBody ?? textBody, postmarkMessageId: sendResult?.MessageID || null }
    });
  }
  return NextResponse.json({ message: 'sent' });
}
