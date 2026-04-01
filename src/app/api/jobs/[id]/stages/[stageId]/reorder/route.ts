import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type RouteParams = { params: Promise<{ id: string; stageId: string }> };

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, stageId } = await params;
  const { newOrder } = await req.json();

  if (typeof newOrder !== 'number') {
    return NextResponse.json({ error: 'New order is required' }, { status: 400 });
  }

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, jobId },
  });

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  const currentOrder = stage.order;

  // Swap orders with the stage at the target position
  await prisma.$transaction(async (tx) => {
    // Find the stage at the target position
    const targetStage = await tx.stage.findFirst({
      where: { jobId, order: newOrder },
    });

    if (targetStage) {
      // First move current stage to a temporary order (to avoid unique constraint)
      await tx.stage.update({
        where: { id: stageId },
        data: { order: -1 },
      });

      // Move target stage to current position
      await tx.stage.update({
        where: { id: targetStage.id },
        data: { order: currentOrder },
      });

      // Move current stage to target position
      await tx.stage.update({
        where: { id: stageId },
        data: { order: newOrder },
      });
    }
  });

  // Fetch all stages with new order
  const stages = await prisma.stage.findMany({
    where: { jobId },
    include: {
      _count: {
        select: {
          applications: true,
          stageRules: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json({ stages });
}
