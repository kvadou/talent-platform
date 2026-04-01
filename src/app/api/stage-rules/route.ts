import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  
  const { searchParams } = new URL(req.url);
  const stageId = searchParams.get('stageId');
  const isActive = searchParams.get('isActive');
  
  const rules = await prisma.stageRule.findMany({
    where: {
      ...(stageId ? { stageId } : {}),
      ...(isActive !== null ? { isActive: isActive === 'true' } : {}),
      ...(access.marketIds ? {
        stage: {
          job: {
            marketId: { in: access.marketIds }
          }
        }
      } : {})
    },
    include: {
      stage: {
        select: {
          id: true,
          name: true,
          job: { select: { id: true, title: true } }
        }
      },
      emailTemplate: {
        select: { id: true, name: true, subject: true }
      },
      sequence: {
        select: { id: true, name: true }
      }
    },
    orderBy: [
      { stageId: 'asc' },
      { order: 'asc' }
    ]
  });
  
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  
  const body = await req.json();
  const { stageId, trigger, actionType, emailTemplateId, taskTemplate, slaOverride, tags, sequenceId, isActive, order } = body;
  
  if (!stageId || !trigger || !actionType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Verify market access
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { job: { select: { marketId: true } } }
  });
  
  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }
  
  if (access.marketIds && !access.marketIds.includes(stage.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const rule = await prisma.stageRule.create({
    data: {
      stageId,
      trigger,
      actionType,
      emailTemplateId: emailTemplateId || null,
      taskTemplate: taskTemplate || null,
      slaOverride: slaOverride || null,
      tags: tags || [],
      sequenceId: sequenceId || null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: order || 0
    },
    include: {
      stage: { select: { name: true } },
      emailTemplate: { select: { name: true } }
    }
  });
  
  return NextResponse.json({ rule });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const body = await req.json();
  const { id, ...updates } = body;
  
  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
  }
  
  const updateData: any = {};
  if (updates.trigger) updateData.trigger = updates.trigger;
  if (updates.actionType) updateData.actionType = updates.actionType;
  if (updates.emailTemplateId !== undefined) updateData.emailTemplateId = updates.emailTemplateId;
  if (updates.taskTemplate !== undefined) updateData.taskTemplate = updates.taskTemplate;
  if (updates.slaOverride !== undefined) updateData.slaOverride = updates.slaOverride;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.sequenceId !== undefined) updateData.sequenceId = updates.sequenceId;
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
  if (updates.order !== undefined) updateData.order = updates.order;
  
  const rule = await prisma.stageRule.update({
    where: { id },
    data: updateData
  });
  
  return NextResponse.json({ rule });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
  }
  
  await prisma.stageRule.delete({
    where: { id }
  });
  
  return NextResponse.json({ success: true });
}

