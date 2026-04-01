import { prisma } from '../prisma';

export interface StageMetrics {
  count: number;
  avgDaysInStage: number;
  slaBreaches: number;
}

export async function getStageMetrics(stageId: string): Promise<StageMetrics> {
  const applications = await prisma.application.findMany({
    where: { stageId },
    include: {
      stageHistory: {
        where: { stageId },
        orderBy: { movedAt: 'asc' },
        take: 1
      }
    }
  });

  const now = new Date();
  let totalDays = 0;
  let countWithHistory = 0;

  applications.forEach((app) => {
    if (app.stageHistory.length > 0) {
      const enteredAt = app.stageHistory[0].movedAt;
      const daysInStage = Math.floor((now.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += daysInStage;
      countWithHistory++;
    }
  });

  const avgDaysInStage = countWithHistory > 0 ? totalDays / countWithHistory : 0;

  // Get SLA breaches for this stage
  const slaConfig = await prisma.slaConfig.findUnique({
    where: { stageId }
  });

  let slaBreaches = 0;
  if (slaConfig) {
    const breaches = await prisma.slaBreach.findMany({
      where: {
        slaConfigId: slaConfig.id,
        resolvedAt: null,
        application: {
          stageId
        }
      }
    });
    slaBreaches = breaches.length;
  }

  return {
    count: applications.length,
    avgDaysInStage,
    slaBreaches
  };
}

export async function getAllStageMetrics(stageIds: string[]): Promise<Record<string, StageMetrics>> {
  const metrics: Record<string, StageMetrics> = {};
  
  await Promise.all(
    stageIds.map(async (stageId) => {
      metrics[stageId] = await getStageMetrics(stageId);
    })
  );
  
  return metrics;
}

