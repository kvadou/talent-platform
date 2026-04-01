import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/dashboard/sla-alerts
 * Get candidates who are stuck in stages (exceeding expected time)
 * Groups by stage and includes candidate details for bulk actions
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const DEFAULT_SLA_DAYS = 5; // Default threshold if no SLA configured

  // Get all active applications with their stage entry time
  // Note: We filter out null stageId in JS (line 87) since Prisma 5.22 has issues with null filters
  const applications = await prisma.application.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      stageId: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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
          slaConfigs: {
            select: {
              targetDays: true,
            },
          },
        },
      },
      stageHistory: {
        orderBy: { movedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate days in stage and group by stage
  const stageAlerts: Record<
    string,
    {
      stageId: string;
      stageName: string;
      stageOrder: number;
      slaTargetDays: number;
      candidates: Array<{
        applicationId: string;
        candidateId: string;
        candidateName: string;
        candidateEmail: string;
        jobId: string;
        jobTitle: string;
        daysInStage: number;
        enteredAt: string;
      }>;
    }
  > = {};

  for (const app of applications) {
    if (!app.stage || !app.stageId) continue;

    // Get entry date - use stage history or fallback to application creation
    const enteredAt =
      app.stageHistory.length > 0
        ? app.stageHistory[0].movedAt
        : new Date(); // Fallback shouldn't happen often

    const daysInStage = Math.floor(
      (now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get SLA threshold (configured or default)
    const slaTargetDays =
      app.stage.slaConfigs?.[0]?.targetDays || DEFAULT_SLA_DAYS;

    // Only include if exceeding SLA
    if (daysInStage < slaTargetDays) continue;

    // Initialize stage group if needed
    if (!stageAlerts[app.stageId]) {
      stageAlerts[app.stageId] = {
        stageId: app.stageId,
        stageName: app.stage.name,
        stageOrder: app.stage.order,
        slaTargetDays,
        candidates: [],
      };
    }

    stageAlerts[app.stageId].candidates.push({
      applicationId: app.id,
      candidateId: app.candidate.id,
      candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`,
      candidateEmail: app.candidate.email,
      jobId: app.job.id,
      jobTitle: app.job.title,
      daysInStage,
      enteredAt: enteredAt.toISOString(),
    });
  }

  // Sort candidates within each stage by days in stage (longest first)
  Object.values(stageAlerts).forEach((stage) => {
    stage.candidates.sort((a, b) => b.daysInStage - a.daysInStage);
  });

  // Convert to sorted array (by stage order)
  const alertsByStage = Object.values(stageAlerts).sort(
    (a, b) => a.stageOrder - b.stageOrder
  );

  // Calculate summary stats
  const totalStuck = alertsByStage.reduce(
    (sum, stage) => sum + stage.candidates.length,
    0
  );
  const longestWait = Math.max(
    ...alertsByStage.flatMap((s) => s.candidates.map((c) => c.daysInStage)),
    0
  );

  return NextResponse.json({
    summary: {
      totalStuck,
      stagesWithBreaches: alertsByStage.length,
      longestWait,
    },
    alertsByStage,
  });
}
