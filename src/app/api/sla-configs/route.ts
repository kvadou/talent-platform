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
  const jobId = searchParams.get('jobId');
  
  const configs = await prisma.slaConfig.findMany({
    where: {
      ...(stageId ? { stageId } : {}),
      ...(jobId ? { jobId } : {}),
      ...(access.marketIds ? {
        OR: [
          { stage: { job: { marketId: { in: access.marketIds } } } },
          { job: { marketId: { in: access.marketIds } } }
        ]
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
      job: {
        select: {
          id: true,
          title: true,
          market: { select: { name: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ configs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  
  const body = await req.json();
  const { stageId, jobId, targetDays, warningDays, isGlobalDefault } = body;
  
  if (!targetDays || !warningDays) {
    return NextResponse.json({ error: 'targetDays and warningDays are required' }, { status: 400 });
  }
  
  // Verify market access
  if (stageId) {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: { job: { select: { marketId: true } } }
    });
    if (!stage || (access.marketIds && !access.marketIds.includes(stage.job.marketId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  
  if (jobId) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { marketId: true }
    });
    if (!job || (access.marketIds && !access.marketIds.includes(job.marketId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  
  // If stageId exists and there's already a config, update it
  if (stageId) {
    const existing = await prisma.slaConfig.findUnique({
      where: { stageId }
    });
    
    if (existing) {
      const config = await prisma.slaConfig.update({
        where: { id: existing.id },
        data: {
          targetDays,
          warningDays,
          isGlobalDefault: Boolean(isGlobalDefault)
        }
      });
      return NextResponse.json({ config });
    }
  }
  
  const config = await prisma.slaConfig.create({
    data: {
      stageId: stageId || null,
      jobId: jobId || null,
      targetDays,
      warningDays,
      isGlobalDefault: Boolean(isGlobalDefault)
    }
  });
  
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  
  const body = await req.json();
  const { id, targetDays, warningDays, isGlobalDefault } = body;
  
  if (!id) {
    return NextResponse.json({ error: 'Config ID is required' }, { status: 400 });
  }
  
  const updateData: any = {};
  if (targetDays !== undefined) updateData.targetDays = targetDays;
  if (warningDays !== undefined) updateData.warningDays = warningDays;
  if (isGlobalDefault !== undefined) updateData.isGlobalDefault = isGlobalDefault;
  
  const config = await prisma.slaConfig.update({
    where: { id },
    data: updateData
  });
  
  return NextResponse.json({ config });
}

