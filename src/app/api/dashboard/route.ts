import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

export const dynamic = 'force-dynamic';

const DASHBOARD_CACHE_TTL_MS = 30_000;
const dashboardCache = new Map<string, { expiresAt: number; payload: unknown }>();

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const cacheKey = `${session.user.email}:${user.id}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    // Get market access
    const access = await getUserMarkets(session.user.email);
    const marketWhere = access.marketIds ? { marketId: { in: access.marketIds } } : {};

    // Date boundaries for trend calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      activeJobs,
      totalApplications,
      myInterviews,
      myTasks,
      myJobs,
      recentApplications,
      pipelineStats,
      pendingScorecards,
      currentApps,
      previousApps,
      currentHires,
      previousHires,
      hiredApps,
      hiredCount,
      recentActivity,
    ] = await Promise.all([
      // Active jobs count
      prisma.job.count({
        where: { ...marketWhere, status: 'PUBLISHED' }
      }),

      // Total applications count
      prisma.application.count({
        where: { job: marketWhere }
      }),

      // My upcoming interviews (next 14 days)
      prisma.interview.findMany({
        where: {
          interviewerId: user.id,
          scheduledAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
        include: {
          application: {
            include: {
              candidate: { select: { firstName: true, lastName: true } },
              job: { select: { id: true, title: true, location: true } },
            },
          },
          scorecard: { select: { id: true, name: true } },
          feedback: {
            where: { userId: user.id },
            select: { id: true },
          },
        },
      }),

      // My pending tasks
      prisma.task.findMany({
        where: {
          assigneeId: user.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        orderBy: [
          { priority: 'desc' },
          { dueAt: 'asc' },
        ],
        take: 10,
        include: {
          application: {
            include: {
              candidate: { select: { firstName: true, lastName: true } },
              job: { select: { title: true } },
            },
          },
          job: { select: { title: true } },
        },
      }),

      // Jobs where user is on hiring team
      prisma.jobHiringTeam.findMany({
        where: {
          userId: user.id,
          job: {
            status: 'PUBLISHED',
            ...marketWhere,
          },
        },
        include: {
          job: {
            include: {
              _count: {
                select: {
                  applications: true,
                },
              },
            },
          },
        },
      }),

      // Recent applications (market-scoped)
      prisma.application.findMany({
        where: { job: marketWhere },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true, location: true } },
          stage: { select: { name: true } },
        },
      }),

      // Pipeline stats by stage (market-scoped)
      prisma.application.groupBy({
        by: ['stageId'],
        where: {
          job: marketWhere,
          status: { notIn: ['REJECTED', 'WITHDRAWN'] },
        },
        _count: { id: true },
      }),

      // Pending scorecards
      prisma.interview.findMany({
        where: {
          interviewerId: user.id,
          scheduledAt: { lt: new Date() },
          feedback: {
            none: { userId: user.id },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        include: {
          application: {
            include: {
              candidate: { select: { firstName: true, lastName: true } },
              job: { select: { id: true, title: true } },
            },
          },
          scorecard: { select: { id: true, name: true } },
        },
      }),

      // Applications in current period (last 30 days)
      prisma.application.count({
        where: { job: marketWhere, createdAt: { gte: thirtyDaysAgo } },
      }),

      // Applications in previous period (30-60 days ago)
      prisma.application.count({
        where: { job: marketWhere, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),

      // Hires in current period
      prisma.application.count({
        where: { job: marketWhere, status: 'HIRED', updatedAt: { gte: thirtyDaysAgo } },
      }),

      // Hires in previous period
      prisma.application.count({
        where: { job: marketWhere, status: 'HIRED', updatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),

      // Hired applications with stage history for time-to-hire
      prisma.application.findMany({
        where: { job: marketWhere, status: 'HIRED' },
        include: {
          stageHistory: { orderBy: { movedAt: 'asc' }, take: 1 },
        },
        take: 100,
      }),

      // Total hired count for conversion rate
      prisma.application.count({
        where: { job: marketWhere, status: 'HIRED' },
      }),

      // Recent activity (market-scoped)
      prisma.activityLog.findMany({
        where: {
          ...(access.marketIds
            ? {
                application: {
                  job: { marketId: { in: access.marketIds } },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true } },
          application: {
            select: {
              id: true,
              candidate: { select: { firstName: true, lastName: true } },
              job: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    // Get stage names for pipeline stats
    const stageIds = pipelineStats.map(s => s.stageId).filter(Boolean) as string[];
    const stages = stageIds.length > 0
      ? await prisma.stage.findMany({
          where: { id: { in: stageIds } },
          select: { id: true, name: true, order: true },
        })
      : [];

    // Build pipeline with stage names
    const pipelineWithNames = pipelineStats.map(stat => {
      const stage = stages.find(s => s.id === stat.stageId);
      return {
        stageId: stat.stageId,
        stageName: stage?.name || 'Unknown',
        order: stage?.order || 0,
        count: stat._count.id,
      };
    }).sort((a, b) => a.order - b.order);

    // Calculate task stats
    const taskStats = {
      overdue: myTasks.filter(t =>
        t.dueAt && new Date(t.dueAt) < new Date()
      ).length,
      total: myTasks.length,
    };

    // Format my jobs with application counts
    const myJobsFormatted = myJobs.map(ht => ({
      id: ht.job.id,
      title: ht.job.title,
      role: ht.role,
      applicationCount: ht.job._count.applications,
    }));

    // Count interviews today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const interviewsToday = myInterviews.filter(i => {
      const scheduled = new Date(i.scheduledAt);
      return scheduled >= todayStart && scheduled <= todayEnd;
    });

    // Calculate average time to hire
    let totalDays = 0, timeToHireCount = 0;
    for (const app of hiredApps) {
      if (app.stageHistory.length > 0) {
        const days = Math.floor((app.updatedAt.getTime() - app.stageHistory[0].movedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) { totalDays += days; timeToHireCount++; }
      }
    }
    const avgTimeToHire = timeToHireCount > 0 ? Math.round(totalDays / timeToHireCount) : 0;

    const responsePayload = {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      stats: {
        activeJobs,
        totalApplications,
        upcomingInterviews: myInterviews.length,
        interviewsToday: interviewsToday.length,
      },
      myInterviews: myInterviews.map(i => ({
        id: i.id,
        scheduledAt: i.scheduledAt,
        type: i.type,
        duration: i.duration,
        location: i.location,
        meetingLink: i.meetingLink,
        candidate: {
          name: `${i.application.candidate.firstName} ${i.application.candidate.lastName}`.trim(),
        },
        job: {
          id: i.application.job.id,
          title: i.application.job.title,
          location: i.application.job.location,
        },
        applicationId: i.applicationId,
        hasScorecard: !!i.scorecardId,
        scorecardName: i.scorecard?.name,
        hasFeedback: i.feedback.length > 0,
      })),
      pendingScorecards: pendingScorecards.map(i => ({
        id: i.id,
        scheduledAt: i.scheduledAt,
        type: i.type,
        candidate: {
          name: `${i.application.candidate.firstName} ${i.application.candidate.lastName}`.trim(),
        },
        job: {
          id: i.application.job.id,
          title: i.application.job.title,
        },
        applicationId: i.applicationId,
        scorecardId: i.scorecardId,
        scorecardName: i.scorecard?.name,
      })),
      myTasks,
      taskStats,
      myJobs: myJobsFormatted,
      recentApplications: recentApplications.map(app => ({
        id: app.id,
        createdAt: app.createdAt,
        candidate: {
          name: `${app.candidate.firstName} ${app.candidate.lastName}`.trim(),
        },
        job: {
          title: app.job.title,
          location: app.job.location,
        },
        stage: app.stage.name,
      })),
      pipeline: pipelineWithNames,
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt,
        user: a.user ? `${a.user.firstName} ${a.user.lastName}` : null,
        applicationId: a.application?.id || null,
        candidateName: a.application?.candidate
          ? `${a.application.candidate.firstName} ${a.application.candidate.lastName}`
          : null,
        jobTitle: a.application?.job?.title || null,
      })),
      trends: {
        applications: {
          current: currentApps,
          previous: previousApps,
          trend: currentApps > previousApps ? 'up' as const : currentApps < previousApps ? 'down' as const : 'neutral' as const,
        },
        hires: {
          current: currentHires,
          previous: previousHires,
          trend: currentHires > previousHires ? 'up' as const : currentHires < previousHires ? 'down' as const : 'neutral' as const,
        },
        timeToHire: avgTimeToHire,
        conversionRate: totalApplications > 0 ? Math.round((hiredCount / totalApplications) * 1000) / 10 : 0,
      },
    };
    dashboardCache.set(cacheKey, {
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
      payload: responsePayload,
    });
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard' },
      { status: 500 }
    );
  }
}
