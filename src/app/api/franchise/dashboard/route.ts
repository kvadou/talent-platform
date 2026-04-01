import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

/**
 * GET /api/franchise/dashboard
 * Simplified dashboard data for franchisee users
 * Returns candidates grouped for easy action-taking
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const marketAccess = await getUserMarkets(session.user.email);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Build market filter
  const marketFilter = marketAccess.marketIds === null
    ? {} // HQ admin sees all
    : { marketId: { in: marketAccess.marketIds } };

  // Get market name for display (use first market for franchisees, or "All Markets" for HQ)
  let marketName = 'All Markets';
  if (marketAccess.marketIds !== null && marketAccess.marketIds.length > 0) {
    const market = await prisma.market.findUnique({
      where: { id: marketAccess.marketIds[0] },
      select: { name: true },
    });
    marketName = market?.name || 'Your Market';
  }

  // Get active jobs in user's markets (PUBLISHED = actively hiring)
  const jobs = await prisma.job.findMany({
    where: {
      ...marketFilter,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
      location: true,
      _count: {
        select: { applications: true },
      },
      applications: {
        where: {
          createdAt: { gte: weekAgo },
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get all active applications with candidate info
  const applications = await prisma.application.findMany({
    where: {
      status: 'ACTIVE',
      job: marketFilter,
    },
    select: {
      id: true,
      createdAt: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
      stageHistory: {
        orderBy: { movedAt: 'desc' },
        take: 1,
      },
      aiScore: true,
      interviews: {
        where: {
          scheduledAt: { gte: now },
        },
        select: {
          id: true,
          scheduledAt: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate days in stage for each application
  const candidates = applications.map((app) => {
    const stageEnteredAt = app.stageHistory[0]?.movedAt || app.createdAt;
    const daysInStage = Math.floor(
      (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      applicationId: app.id,
      candidateId: app.candidate.id,
      name: `${app.candidate.firstName} ${app.candidate.lastName}`,
      email: app.candidate.email,
      phone: app.candidate.phone || undefined,
      jobId: app.job.id,
      jobTitle: app.job.title,
      stage: app.stage?.name || 'New',
      stageOrder: app.stage?.order ?? 0,
      aiScore: app.aiScore || undefined,
      daysInStage,
      appliedAt: app.createdAt.toISOString(),
      hasInterview: app.interviews.length > 0,
      interviewDate: app.interviews[0]?.scheduledAt?.toISOString(),
    };
  });

  // Calculate stats
  const newThisWeek = applications.filter(
    (app) => app.createdAt >= weekAgo
  ).length;

  const scheduledInterviews = applications.filter(
    (app) => app.interviews.length > 0
  ).length;

  const pendingReview = applications.filter(
    (app) => (app.stage?.order ?? 0) === 0
  ).length;

  // Format jobs for frontend
  const formattedJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    location: job.location || undefined,
    applicationCount: job._count.applications,
    newThisWeek: job.applications.length,
  }));

  return NextResponse.json({
    marketName,
    jobs: formattedJobs,
    candidates,
    stats: {
      totalApplications: applications.length,
      newThisWeek,
      scheduledInterviews,
      pendingReview,
    },
  });
}
