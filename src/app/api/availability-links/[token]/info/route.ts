import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const link = await prisma.availabilityLink.findUnique({
    where: { token },
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
    return NextResponse.json({ error: 'Invalid availability link' }, { status: 404 });
  }

  if (link.status === 'EXPIRED' || link.status === 'CANCELLED') {
    return NextResponse.json({ error: 'This availability link is no longer active' }, { status: 410 });
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    // Update status to expired
    await prisma.availabilityLink.update({
      where: { id: link.id },
      data: { status: 'EXPIRED' }
    });
    return NextResponse.json({ error: 'This availability link has expired' }, { status: 410 });
  }

  return NextResponse.json({
    jobTitle: link.application.job.title,
    stageName: link.stage.name,
    candidateName: `${link.application.candidate.firstName} ${link.application.candidate.lastName}`,
    duration: link.duration,
    timezone: link.timezone || 'America/Chicago',
    instructions: link.instructions,
    dateRangeStart: link.dateRangeStart?.toISOString() || null,
    dateRangeEnd: link.dateRangeEnd?.toISOString() || null,
    status: link.status
  });
}
