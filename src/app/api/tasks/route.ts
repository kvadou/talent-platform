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
  const applicationId = searchParams.get('applicationId');
  const jobId = searchParams.get('jobId');
  const stageId = searchParams.get('stageId');
  const status = searchParams.get('status');
  const assigneeId = searchParams.get('assigneeId');
  
  const tasks = await prisma.task.findMany({
    where: {
      ...(applicationId ? { applicationId } : {}),
      ...(jobId ? { jobId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(access.marketIds ? {
        OR: [
          { job: { marketId: { in: access.marketIds } } },
          { application: { job: { marketId: { in: access.marketIds } } } }
        ]
      } : {})
    },
    include: {
      application: {
        select: {
          id: true,
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } }
        }
      },
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true } },
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } }
    },
    orderBy: [
      { dueAt: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' }
    ],
    take: 500
  });
  
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const dbUser = await ensureUser();
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  
  const body = await req.json();
  const { applicationId, jobId, stageId, title, description, assigneeId, priority, dueAt } = body;
  
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  
  const task = await prisma.task.create({
    data: {
      applicationId: applicationId || null,
      jobId: jobId || null,
      stageId: stageId || null,
      title,
      description: description || null,
      assigneeId: assigneeId || dbUser.id,
      priority: priority || 'MEDIUM',
      dueAt: dueAt ? new Date(dueAt) : null
    },
    include: {
      assignee: { select: { firstName: true, lastName: true } }
    }
  });
  
  return NextResponse.json({ task });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const body = await req.json();
  const { id, ...updates } = body;
  
  if (!id) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }
  
  const updateData: any = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.priority) updateData.priority = updates.priority;
  if (updates.title) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.assigneeId) updateData.assigneeId = updates.assigneeId;
  if (updates.dueAt) updateData.dueAt = new Date(updates.dueAt);
  if (updates.status === 'COMPLETED' && !updates.completedAt) {
    updateData.completedAt = new Date();
  }
  
  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      assignee: { select: { firstName: true, lastName: true } }
    }
  });
  
  return NextResponse.json({ task });
}

