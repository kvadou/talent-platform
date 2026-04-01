import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessApplication, canAccessJob, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { id } = await params;

  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { targetJobId, targetStageId } = await req.json();

  if (!targetJobId) {
    return NextResponse.json({ error: 'Target job ID is required' }, { status: 400 });
  }

  // Verify user can access the target job's market
  if (!(await canAccessJob(auth.email, targetJobId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the application
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, title: true } },
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Get the target job and its first stage if no stage specified
  const targetJob = await prisma.job.findUnique({
    where: { id: targetJobId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        take: 1,
      },
    },
  });

  if (!targetJob) {
    return NextResponse.json({ error: 'Target job not found' }, { status: 404 });
  }

  const stageId = targetStageId || targetJob.stages[0]?.id;

  if (!stageId) {
    return NextResponse.json({ error: 'Target job has no stages' }, { status: 400 });
  }

  // Update the application to the new job
  const updatedApplication = await prisma.application.update({
    where: { id },
    data: {
      jobId: targetJobId,
      stageId: stageId,
    },
    include: {
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true } },
      candidate: { select: { firstName: true, lastName: true } },
    },
  });

  // Add a note about the transfer
  await prisma.note.create({
    data: {
      applicationId: id,
      authorId: auth.id,
      content: `Candidate transferred from "${application.job.title}" to "${targetJob.title}"`,
      isPrivate: false,
    },
  });

  return NextResponse.json(updatedApplication);
}
