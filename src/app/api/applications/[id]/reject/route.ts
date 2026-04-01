import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { rejectTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { cancelApplicationInterviews } from '@/lib/interview-cancellation';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;
  if (!(await canAccessApplication(auth.email, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Wrap DB mutations in a transaction for consistency
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.application.update({
      where: { id: params.id },
      data: { status: 'REJECTED' }
    });
    await tx.stageHistory.create({ data: { applicationId: app.id, stageId: app.stageId } });
    return app;
  });

  // Side effects after transaction commits
  const cancelledInterviews = await cancelApplicationInterviews(params.id).catch((err) => {
    console.error('Failed to cancel interviews:', err);
    return 0;
  });

  const candidate = await prisma.candidate.findUnique({ where: { id: application.candidateId } });
  if (candidate) {
    try {
      const mergeData = buildMergeData({
        candidate: { firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email },
      });
      const dbTemplate = await resolveTemplate('APPLICATION_REJECTION', mergeData);
      const template = dbTemplate || rejectTemplate(candidate.firstName);
      const sendResult = await sendEmail({ to: candidate.email, subject: template.subject, htmlBody: template.html });

      await prisma.messageLog.create({
        data: {
          applicationId: params.id,
          type: 'EMAIL',
          recipient: candidate.email,
          subject: template.subject,
          body: template.html,
          status: 'SENT',
          postmarkMessageId: sendResult?.MessageID || null,
        },
      });
    } catch (err) {
      console.error('Reject email failed', err);
    }
  }
  return NextResponse.json({ message: 'Rejected', application, cancelledInterviews });
}
