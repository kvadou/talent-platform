import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { HiringTeamRole } from '@prisma/client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const team = await prisma.jobHiringTeam.findMany({
    where: { jobId },
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
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ team });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { userId: memberUserId, role, isResponsibleForTasks, permissions } = await req.json();

  if (!memberUserId || !role) {
    return NextResponse.json(
      { error: 'User and role are required' },
      { status: 400 }
    );
  }

  // Check if user is already on the team with this role
  const existing = await prisma.jobHiringTeam.findFirst({
    where: { jobId, userId: memberUserId, role: role as HiringTeamRole },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'User already has this role on the team' },
      { status: 400 }
    );
  }

  const member = await prisma.jobHiringTeam.create({
    data: {
      jobId,
      userId: memberUserId,
      role: role as HiringTeamRole,
      isResponsibleForTasks: isResponsibleForTasks ?? false,
      permissions: permissions ?? [],
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

  return NextResponse.json(member, { status: 201 });
}
