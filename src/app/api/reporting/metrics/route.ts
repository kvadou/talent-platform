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
  const range = searchParams.get('range') || '30d';
  const marketId = searchParams.get('marketId');
  const jobId = searchParams.get('jobId');

  // Calculate date range
  const now = new Date();
  let startDate: Date | null = null;
  if (range === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (range === '90d') {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  const whereClause: any = access.marketIds
    ? { job: { marketId: { in: access.marketIds } } }
    : {};

  // Additional filters
  if (marketId) {
    whereClause.job = { ...whereClause.job, marketId: marketId };
  }
  if (jobId) {
    whereClause.jobId = jobId;
  }

  if (startDate) {
    whereClause.createdAt = { gte: startDate };
  }
  
  // Get all applications
  const applications = await prisma.application.findMany({
    where: whereClause,
    include: {
      candidate: true,
      job: true,
      stage: true,
      stageHistory: {
        include: {
          stage: true
        },
        orderBy: { movedAt: 'asc' }
      }
    }
  });
  
  // Calculate metrics
  const totalApplications = applications.length;
  const activeApplications = applications.filter((a) => a.status === 'ACTIVE').length;
  const hired = applications.filter((a) => a.status === 'HIRED');
  const rejected = applications.filter((a) => a.status === 'REJECTED');
  
  // Calculate average time to hire
  let totalTimeToHire = 0;
  let hiredWithHistory = 0;
  for (const app of hired) {
    if (app.stageHistory.length > 0) {
      const firstEntry = app.stageHistory[0];
      const lastEntry = app.stageHistory[app.stageHistory.length - 1];
      const timeToHire = Math.floor(
        (lastEntry.movedAt.getTime() - firstEntry.movedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalTimeToHire += timeToHire;
      hiredWithHistory++;
    }
  }
  const avgTimeToHire = hiredWithHistory > 0 ? totalTimeToHire / hiredWithHistory : 0;
  
  // Calculate average time in stage
  const stageTimes: Record<string, { totalDays: number; count: number; stageName: string }> = {};
  for (const app of applications) {
    for (let i = 0; i < app.stageHistory.length - 1; i++) {
      const current = app.stageHistory[i];
      const next = app.stageHistory[i + 1];
      const daysInStage = Math.floor(
        (next.movedAt.getTime() - current.movedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (!stageTimes[current.stageId]) {
        stageTimes[current.stageId] = {
          totalDays: 0,
          count: 0,
          stageName: current.stage.name
        };
      }
      stageTimes[current.stageId].totalDays += daysInStage;
      stageTimes[current.stageId].count++;
    }
  }
  
  const avgTimeInStage: Record<string, { stageName: string; avgDays: number }> = {};
  for (const [stageId, data] of Object.entries(stageTimes)) {
    avgTimeInStage[stageId] = {
      stageName: data.stageName,
      avgDays: data.count > 0 ? data.totalDays / data.count : 0
    };
  }
  
  // Get SLA breaches
  const slaBreaches = await prisma.slaBreach.count({
    where: {
      resolvedAt: null,
      ...(access.marketIds
        ? {
            application: {
              job: {
                marketId: { in: access.marketIds }
              }
            }
          }
        : {})
    }
  });
  
  // Get real source data from applications
  const sourceData = await prisma.application.groupBy({
    by: ['source'],
    where: whereClause,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const SOURCE_LABELS: Record<string, string> = {
    CAREER_PAGE: 'Career Page',
    LINKEDIN: 'LinkedIn',
    INDEED: 'Indeed',
    GOOGLE: 'Google',
    REFERRAL: 'Referral',
    AGENCY: 'Agency',
    DIRECT: 'Direct',
    GREENHOUSE: 'Greenhouse',
    OTHER: 'Other',
  };

  const topSources = sourceData.map((s) => ({
    source: s.source ? (SOURCE_LABELS[s.source] || s.source) : 'Unknown',
    count: s._count.id,
  }));
  
  const metrics = {
    totalApplications,
    activeApplications,
    hiredCount: hired.length,
    rejectedCount: rejected.length,
    avgTimeToHire,
    avgTimeInStage,
    slaBreaches,
    topSources
  };
  
  // Get markets and jobs for filter dropdowns
  const [markets, jobs] = await Promise.all([
    prisma.market.findMany({
      where: access.marketIds ? { id: { in: access.marketIds } } : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.job.findMany({
      where: {
        ...(access.marketIds ? { marketId: { in: access.marketIds } } : {}),
        ...(marketId ? { marketId } : {}),
      },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  return NextResponse.json({ metrics, markets, jobs });
}

