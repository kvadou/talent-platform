import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { HiringTeamRole } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string; memberId: string }> };

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, memberId } = await params;
  const { role, isResponsibleForTasks, permissions } = await req.json();

  const member = await prisma.jobHiringTeam.findFirst({
    where: { id: memberId, jobId },
  });

  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  const updated = await prisma.jobHiringTeam.update({
    where: { id: memberId },
    data: {
      ...(role && { role: role as HiringTeamRole }),
      ...(typeof isResponsibleForTasks === 'boolean' && { isResponsibleForTasks }),
      ...(permissions && { permissions }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, memberId } = await params;

  const member = await prisma.jobHiringTeam.findFirst({
    where: { id: memberId, jobId },
  });

  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  await prisma.jobHiringTeam.delete({
    where: { id: memberId },
  });

  return NextResponse.json({ success: true });
}
