import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const marketId = url.searchParams.get('marketId') || null;
  const jobId = url.searchParams.get('jobId') || null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Build market filter
  const marketFilter = marketId
    ? { marketId }
    : access.marketIds
    ? { marketId: { in: access.marketIds } }
    : {};

  // ========== TIME TO HIRE ==========
  // Get all applications with hire date (via offer acceptance)
  const hiredApplications = await prisma.application.findMany({
    where: {
      createdAt: { gte: startDate },
      job: marketFilter,
      ...(jobId ? { jobId } : {}),
      offer: {
        status: 'ACCEPTED',
      },
    },
    select: {
      id: true,
      createdAt: true,
      source: true,
      job: { select: { id: true, title: true, marketId: true } },
      offer: { select: { acceptedAt: true } },
    },
  });

  // Calculate time to hire for each
  const timeToHireData = hiredApplications
    .filter((app) => app.offer?.acceptedAt)
    .map((app) => ({
      applicationId: app.id,
      jobId: app.job.id,
      jobTitle: app.job.title,
      marketId: app.job.marketId,
      source: app.source || 'UNKNOWN',
      daysToHire: Math.round(
        (new Date(app.offer!.acceptedAt!).getTime() - new Date(app.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }));

  const avgTimeToHire =
    timeToHireData.length > 0
      ? Math.round(timeToHireData.reduce((sum, d) => sum + d.daysToHire, 0) / timeToHireData.length)
      : 0;

  // Time to hire trend by week
  const tthByWeek: Record<string, number[]> = {};
  timeToHireData.forEach((d) => {
    const app = hiredApplications.find((a) => a.id === d.applicationId);
    if (app) {
      const week = getWeekKey(new Date(app.createdAt));
      if (!tthByWeek[week]) tthByWeek[week] = [];
      tthByWeek[week].push(d.daysToHire);
    }
  });

  const timeToHireTrend = Object.entries(tthByWeek)
    .map(([week, days]) => ({
      week,
      avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      count: days.length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // ========== SOURCE EFFECTIVENESS ==========
  // Get all applications in date range
  const allApplications = await prisma.application.findMany({
    where: {
      createdAt: { gte: startDate },
      job: marketFilter,
      ...(jobId ? { jobId } : {}),
    },
    select: {
      id: true,
      source: true,
      aiScore: true,
      status: true,
      offer: { select: { status: true } },
    },
  });

  // Group by source
  const sourceStats: Record<
    string,
    { total: number; hired: number; avgScore: number; scores: number[] }
  > = {};

  allApplications.forEach((app) => {
    const source = app.source || 'UNKNOWN';
    if (!sourceStats[source]) {
      sourceStats[source] = { total: 0, hired: 0, avgScore: 0, scores: [] };
    }
    sourceStats[source].total++;
    if (app.offer?.status === 'ACCEPTED') {
      sourceStats[source].hired++;
    }
    if (app.aiScore) {
      sourceStats[source].scores.push(app.aiScore);
    }
  });

  const sourceEffectiveness = Object.entries(sourceStats)
    .map(([source, stats]) => ({
      source,
      applications: stats.total,
      hires: stats.hired,
      hireRate: stats.total > 0 ? Math.round((stats.hired / stats.total) * 100) : 0,
      avgAiScore:
        stats.scores.length > 0
          ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
          : null,
    }))
    .sort((a, b) => b.applications - a.applications);

  // ========== PIPELINE VELOCITY ==========
  // Get stage history for applications in date range
  const stageHistory = await prisma.stageHistory.findMany({
    where: {
      movedAt: { gte: startDate },
      application: {
        job: marketFilter,
        ...(jobId ? { jobId } : {}),
      },
    },
    select: {
      applicationId: true,
      stageId: true,
      movedAt: true,
      stage: { select: { name: true, order: true } },
    },
    orderBy: [{ applicationId: 'asc' }, { movedAt: 'asc' }],
  });

  // Calculate time in each stage
  const stageTimeData: Record<string, { name: string; durations: number[]; order: number }> = {};

  // Group by application
  const historyByApp: Record<string, typeof stageHistory> = {};
  stageHistory.forEach((h) => {
    if (!historyByApp[h.applicationId]) historyByApp[h.applicationId] = [];
    historyByApp[h.applicationId].push(h);
  });

  Object.values(historyByApp).forEach((history) => {
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      const daysInStage = Math.round(
        (new Date(next.movedAt).getTime() - new Date(current.movedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (!stageTimeData[current.stageId]) {
        stageTimeData[current.stageId] = {
          name: current.stage.name,
          durations: [],
          order: current.stage.order,
        };
      }
      stageTimeData[current.stageId].durations.push(daysInStage);
    }
  });

  const pipelineVelocity = Object.entries(stageTimeData)
    .map(([stageId, data]) => ({
      stageId,
      stageName: data.name,
      order: data.order,
      avgDays:
        data.durations.length > 0
          ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
          : 0,
      candidates: data.durations.length,
    }))
    .sort((a, b) => a.order - b.order);

  // ========== SUMMARY STATS ==========
  const totalApplications = allApplications.length;
  const totalHires = allApplications.filter((a) => a.offer?.status === 'ACCEPTED').length;
  const activeApplications = allApplications.filter((a) => a.status === 'ACTIVE').length;

  // ========== WEEKLY TREND ==========
  const appsByWeek: Record<string, { applications: number; hires: number }> = {};
  allApplications.forEach((app) => {
    // We need createdAt for this
  });

  // Get applications with dates for trend
  const appsWithDates = await prisma.application.findMany({
    where: {
      createdAt: { gte: startDate },
      job: marketFilter,
      ...(jobId ? { jobId } : {}),
    },
    select: {
      createdAt: true,
      offer: { select: { status: true, acceptedAt: true } },
    },
  });

  appsWithDates.forEach((app) => {
    const week = getWeekKey(new Date(app.createdAt));
    if (!appsByWeek[week]) appsByWeek[week] = { applications: 0, hires: 0 };
    appsByWeek[week].applications++;
    if (app.offer?.status === 'ACCEPTED') {
      appsByWeek[week].hires++;
    }
  });

  const weeklyTrend = Object.entries(appsByWeek)
    .map(([week, data]) => ({
      week,
      ...data,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return NextResponse.json({
    summary: {
      totalApplications,
      totalHires,
      activeApplications,
      avgTimeToHire,
      conversionRate: totalApplications > 0 ? Math.round((totalHires / totalApplications) * 100) : 0,
    },
    timeToHire: {
      average: avgTimeToHire,
      trend: timeToHireTrend,
      bySource: Object.entries(
        timeToHireData.reduce((acc, d) => {
          if (!acc[d.source]) acc[d.source] = [];
          acc[d.source].push(d.daysToHire);
          return acc;
        }, {} as Record<string, number[]>)
      ).map(([source, days]) => ({
        source,
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        count: days.length,
      })),
    },
    sourceEffectiveness,
    pipelineVelocity,
    weeklyTrend,
    dateRange: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
      days,
    },
  });
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
  return d.toISOString().split('T')[0];
}
