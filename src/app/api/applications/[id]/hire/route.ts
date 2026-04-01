import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { hireTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;
  if (!(await canAccessApplication(auth.email, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const current = await prisma.application.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const hiredStage = await prisma.stage.findFirst({ where: { jobId: current.jobId, name: 'Hired' } });

  // Wrap DB mutations in a transaction for consistency
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.application.update({
      where: { id: params.id },
      data: { status: 'HIRED', stageId: hiredStage?.id ?? current.stageId, updatedAt: new Date() }
    });
    await tx.stageHistory.create({ data: { applicationId: app.id, stageId: app.stageId } });
    return app;
  });

  // Send email after transaction commits (side effect, not rolled back)
  const candidate = await prisma.candidate.findUnique({ where: { id: application.candidateId } });
  if (candidate) {
    try {
      const mergeData = buildMergeData({
        candidate: { firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email },
      });
      const dbTemplate = await resolveTemplate('OFFER_ACCEPTED', mergeData);
      const template = dbTemplate || hireTemplate(candidate.firstName);
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
      console.error('Hire email failed', err);
    }
  }
  return NextResponse.json({ message: 'Hired', application });
}
