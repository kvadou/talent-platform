import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const stages = await prisma.stage.findMany({
    where: { jobId },
    include: {
      _count: {
        select: {
          applications: true,
          stageRules: true,
        },
      },
      interviewKits: {
        select: {
          id: true,
          name: true,
          type: true,
          duration: true,
          includesAudition: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json({ stages });
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
  const { name } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Get the highest order number
  const lastStage = await prisma.stage.findFirst({
    where: { jobId },
    orderBy: { order: 'desc' },
  });

  const newOrder = (lastStage?.order ?? 0) + 1;

  const stage = await prisma.stage.create({
    data: {
      jobId,
      name,
      order: newOrder,
      isDefault: false,
    },
    include: {
      _count: {
        select: {
          applications: true,
          stageRules: true,
        },
      },
    },
  });

  return NextResponse.json(stage, { status: 201 });
}
