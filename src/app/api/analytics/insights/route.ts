import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'action';
  category: 'source' | 'pipeline' | 'quality' | 'speed';
  title: string;
  description: string;
  metric?: string;
  actionable?: string;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const marketFilter = access.marketIds ? { marketId: { in: access.marketIds } } : {};

  const insights: Insight[] = [];

  // ========== Fetch all data we need ==========
  const [applications, hiredApps, stageHistory] = await Promise.all([
    // All applications
    prisma.application.findMany({
      where: { createdAt: { gte: startDate }, job: marketFilter },
      select: {
        id: true,
        source: true,
        aiScore: true,
        status: true,
        createdAt: true,
        offer: { select: { status: true, acceptedAt: true } },
      },
    }),
    // Hired applications
    prisma.application.findMany({
      where: {
        createdAt: { gte: startDate },
        job: marketFilter,
        offer: { status: 'ACCEPTED' },
      },
      select: {
        id: true,
        source: true,
        aiScore: true,
        createdAt: true,
        offer: { select: { acceptedAt: true } },
      },
    }),
    // Stage history for bottleneck detection
    prisma.stageHistory.findMany({
      where: {
        movedAt: { gte: startDate },
        application: { job: marketFilter },
      },
      select: {
        applicationId: true,
        stageId: true,
        movedAt: true,
        stage: { select: { name: true, order: true } },
      },
      orderBy: [{ applicationId: 'asc' }, { movedAt: 'asc' }],
    }),
  ]);

  // ========== SOURCE INSIGHTS ==========
  const sourceStats: Record<string, { total: number; hired: number; avgScore: number; scores: number[] }> = {};
  applications.forEach((app) => {
    const source = app.source || 'UNKNOWN';
    if (!sourceStats[source]) sourceStats[source] = { total: 0, hired: 0, avgScore: 0, scores: [] };
    sourceStats[source].total++;
    if (app.offer?.status === 'ACCEPTED') sourceStats[source].hired++;
    if (app.aiScore) sourceStats[source].scores.push(app.aiScore);
  });

  // Calculate hire rates
  const sourceRates = Object.entries(sourceStats)
    .filter(([, stats]) => stats.total >= 5) // Only sources with enough data
    .map(([source, stats]) => ({
      source,
      total: stats.total,
      hired: stats.hired,
      rate: (stats.hired / stats.total) * 100,
      avgScore: stats.scores.length > 0 ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  // Best performing source
  if (sourceRates.length > 0 && sourceRates[0].rate > 0) {
    const best = sourceRates[0];
    const avgRate = sourceRates.reduce((sum, s) => sum + s.rate, 0) / sourceRates.length;
    if (best.rate > avgRate * 1.5) {
      insights.push({
        id: 'source-best',
        type: 'success',
        category: 'source',
        title: `${formatSource(best.source)} outperforms other sources`,
        description: `${formatSource(best.source)} candidates have a ${best.rate.toFixed(0)}% hire rate, which is ${((best.rate / avgRate - 1) * 100).toFixed(0)}% higher than average.`,
        metric: `${best.rate.toFixed(0)}% hire rate`,
        actionable: `Consider increasing investment in ${formatSource(best.source)} job postings.`,
      });
    }
  }

  // Worst performing source with significant volume
  const worstSource = sourceRates.find((s) => s.rate === 0 && s.total >= 10);
  if (worstSource) {
    insights.push({
      id: 'source-worst',
      type: 'warning',
      category: 'source',
      title: `${formatSource(worstSource.source)} generating no hires`,
      description: `${worstSource.total} applications from ${formatSource(worstSource.source)} with 0 hires. This may indicate poor candidate fit or targeting.`,
      metric: `0/${worstSource.total} hired`,
      actionable: `Review job postings on ${formatSource(worstSource.source)} or reconsider this channel.`,
    });
  }

  // High AI score + high hire rate correlation
  const highScoreHires = hiredApps.filter((a) => a.aiScore && a.aiScore >= 80);
  const lowScoreHires = hiredApps.filter((a) => a.aiScore && a.aiScore < 60);
  if (highScoreHires.length > lowScoreHires.length * 2 && highScoreHires.length >= 3) {
    insights.push({
      id: 'ai-accuracy',
      type: 'success',
      category: 'quality',
      title: 'AI scoring is predictive of hiring success',
      description: `${highScoreHires.length} of your hires scored 80+ by AI, while only ${lowScoreHires.length} scored below 60. AI is accurately identifying top candidates.`,
      metric: `${((highScoreHires.length / hiredApps.length) * 100).toFixed(0)}% of hires were AI high-scorers`,
    });
  }

  // ========== PIPELINE VELOCITY INSIGHTS ==========
  const stageTimeData: Record<string, { name: string; durations: number[] }> = {};
  const historyByApp: Record<string, typeof stageHistory> = {};
  stageHistory.forEach((h) => {
    if (!historyByApp[h.applicationId]) historyByApp[h.applicationId] = [];
    historyByApp[h.applicationId].push(h);
  });

  Object.values(historyByApp).forEach((history) => {
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      const daysInStage = (new Date(next.movedAt).getTime() - new Date(current.movedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (!stageTimeData[current.stageId]) {
        stageTimeData[current.stageId] = { name: current.stage.name, durations: [] };
      }
      stageTimeData[current.stageId].durations.push(daysInStage);
    }
  });

  // Find bottlenecks (stages with avg > 5 days)
  const bottlenecks = Object.entries(stageTimeData)
    .map(([, data]) => ({
      name: data.name,
      avgDays: data.durations.length > 0 ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length : 0,
      count: data.durations.length,
    }))
    .filter((s) => s.avgDays > 5 && s.count >= 3)
    .sort((a, b) => b.avgDays - a.avgDays);

  if (bottlenecks.length > 0) {
    const worst = bottlenecks[0];
    insights.push({
      id: 'bottleneck',
      type: 'warning',
      category: 'pipeline',
      title: `"${worst.name}" stage is slowing down your pipeline`,
      description: `Candidates spend an average of ${worst.avgDays.toFixed(1)} days in the ${worst.name} stage. This bottleneck may be causing candidate drop-off.`,
      metric: `${worst.avgDays.toFixed(1)} avg days`,
      actionable: `Review capacity in the ${worst.name} stage or consider automating parts of this step.`,
    });
  }

  // ========== TIME TO HIRE INSIGHTS ==========
  const timesToHire = hiredApps
    .filter((a) => a.offer?.acceptedAt)
    .map((a) => (new Date(a.offer!.acceptedAt!).getTime() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  if (timesToHire.length >= 3) {
    const avgTTH = timesToHire.reduce((a, b) => a + b, 0) / timesToHire.length;
    const fastHires = timesToHire.filter((t) => t <= 14).length;
    const slowHires = timesToHire.filter((t) => t > 30).length;

    if (avgTTH <= 21) {
      insights.push({
        id: 'tth-fast',
        type: 'success',
        category: 'speed',
        title: 'Your hiring speed is excellent',
        description: `Average time to hire is ${avgTTH.toFixed(0)} days. ${fastHires} of ${timesToHire.length} hires happened within 2 weeks.`,
        metric: `${avgTTH.toFixed(0)} days avg`,
      });
    } else if (avgTTH > 45) {
      insights.push({
        id: 'tth-slow',
        type: 'warning',
        category: 'speed',
        title: 'Hiring is taking too long',
        description: `Average time to hire is ${avgTTH.toFixed(0)} days. ${slowHires} hires took over 30 days, risking candidate drop-off.`,
        metric: `${avgTTH.toFixed(0)} days avg`,
        actionable: 'Review your pipeline for bottlenecks and consider expediting interview scheduling.',
      });
    }
  }

  // ========== QUALITY INSIGHTS ==========
  // Check for high-score rejections
  const highScoreRejected = applications.filter(
    (a) => a.aiScore && a.aiScore >= 85 && a.status === 'REJECTED'
  );
  if (highScoreRejected.length >= 5) {
    insights.push({
      id: 'high-score-rejected',
      type: 'info',
      category: 'quality',
      title: `${highScoreRejected.length} high-scoring candidates were rejected`,
      description: `You rejected ${highScoreRejected.length} candidates who scored 85+ by AI. This may indicate AI miscalibration or evolving job requirements.`,
      metric: `${highScoreRejected.length} candidates`,
      actionable: 'Review these candidates to ensure AI criteria aligns with actual hiring decisions.',
    });
  }

  // Low volume warning
  if (applications.length < 10) {
    insights.push({
      id: 'low-volume',
      type: 'info',
      category: 'pipeline',
      title: 'Limited data for insights',
      description: `Only ${applications.length} applications in the last ${days} days. More data will enable better insights.`,
      metric: `${applications.length} applications`,
    });
  }

  return NextResponse.json({
    insights,
    generatedAt: new Date().toISOString(),
    dataRange: { days, start: startDate.toISOString(), end: new Date().toISOString() },
  });
}

function formatSource(source: string): string {
  return source.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
