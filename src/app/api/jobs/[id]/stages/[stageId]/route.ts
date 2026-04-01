import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type RouteParams = { params: Promise<{ id: string; stageId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, stageId } = await params;

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, jobId },
    include: {
      stageRules: {
        include: {
          emailTemplate: { select: { id: true, name: true } },
          sequence: { select: { id: true, name: true } },
        },
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  return NextResponse.json(stage);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, stageId } = await params;
  const { name, isDefault, defaultInterviewType } = await req.json();

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, jobId },
  });

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  // If setting as default, unset other defaults first
  if (isDefault && !stage.isDefault) {
    await prisma.stage.updateMany({
      where: { jobId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.stage.update({
    where: { id: stageId },
    data: {
      ...(name && { name }),
      ...(typeof isDefault === 'boolean' && { isDefault }),
      ...(defaultInterviewType !== undefined && { defaultInterviewType: defaultInterviewType || null }),
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

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, stageId } = await params;

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, jobId },
    include: {
      _count: {
        select: { applications: true },
      },
    },
  });

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  if (stage.isDefault) {
    return NextResponse.json(
      { error: 'Cannot delete the default stage' },
      { status: 400 }
    );
  }

  if (stage._count.applications > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a stage with candidates' },
      { status: 400 }
    );
  }

  await prisma.stage.delete({
    where: { id: stageId },
  });

  return NextResponse.json({ success: true });
}
