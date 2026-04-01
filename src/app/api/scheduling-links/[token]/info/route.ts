import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hashedToken = hashToken(token);

  const link = await prisma.schedulingLink.findUnique({
    where: { token: hashedToken },
    include: {
      application: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true }
          },
          job: {
            select: { title: true }
          }
        }
      },
      stage: {
        select: { name: true }
      }
    }
  });

  if (!link) {
    return NextResponse.json({ error: 'Invalid scheduling link' }, { status: 404 });
  }

  if (link.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Scheduling link is no longer active' }, { status: 410 });
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Scheduling link has expired' }, { status: 410 });
  }

  // Get primary interviewer name
  let interviewerName = 'Our Team';
  if (link.interviewerIds.length > 0) {
    const interviewer = await prisma.user.findUnique({
      where: { id: link.interviewerIds[0] },
      select: { firstName: true, lastName: true }
    });
    if (interviewer) {
      interviewerName = `${interviewer.firstName} ${interviewer.lastName}`;
    }
  }

  return NextResponse.json({
    jobTitle: link.application.job.title,
    stageName: link.stage.name,
    candidateName: `${link.application.candidate.firstName} ${link.application.candidate.lastName}`,
    duration: link.duration,
    timezone: link.timezone || 'America/Chicago',
    interviewerName
  });
}
