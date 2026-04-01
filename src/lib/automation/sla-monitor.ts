import { prisma } from '../prisma';
import { executeStageRules } from './stage-rules';

export async function checkSlaBreaches() {
  const now = new Date();
  
  // Get all active applications with SLA configs
  const applications = await prisma.application.findMany({
    where: {
      status: 'ACTIVE',
      stage: {
        slaConfigs: {
          some: {}
        }
      }
    },
    include: {
      stage: {
        include: {
          slaConfigs: true
        }
      },
      stageHistory: {
        where: {
          stageId: {
            in: [] // Will be set below
          }
        },
        orderBy: { movedAt: 'asc' },
        take: 1
      },
      slaBreaches: {
        where: {
          resolvedAt: null
        }
      }
    }
  });

  for (const application of applications) {
    const slaConfig = application.stage.slaConfigs[0];
    if (!slaConfig) continue;

    // Check if already breached
    const existingBreach = application.slaBreaches.find(
      (b) => b.slaConfigId === slaConfig.id && !b.resolvedAt
    );
    if (existingBreach) continue;

    // Find when application entered this stage
    const stageEntry = await prisma.stageHistory.findFirst({
      where: {
        applicationId: application.id,
        stageId: application.stageId
      },
      orderBy: { movedAt: 'asc' }
    });

    if (!stageEntry) continue;

    const daysInStage = Math.floor(
      (now.getTime() - stageEntry.movedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysInStage >= slaConfig.targetDays) {
      // Create breach record
      await prisma.slaBreach.create({
        data: {
          applicationId: application.id,
          slaConfigId: slaConfig.id,
          breachedAt: now
        }
      });

      // Execute onSlaBreach stage rules (send email, create task, etc.)
      await executeStageRules(application.id, application.stageId, 'onSlaBreach').catch((err) => {
        console.error(`Failed to execute SLA breach rules for application ${application.id}:`, err);
      });
    }
  }
}

