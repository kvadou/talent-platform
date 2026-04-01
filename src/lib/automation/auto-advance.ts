import { prisma } from '../prisma';
import { ActivityLogger } from '../activity-logger';
import { executeStageRules } from './stage-rules';

export interface AutoAdvanceResult {
  advanced: boolean;
  applicationId: string;
  fromStage?: string;
  toStage?: string;
  score?: number;
  threshold?: number;
  reason?: string;
}

/**
 * Check if an application should be auto-advanced based on AI score
 * and job configuration. If criteria are met, move the application
 * to the configured target stage.
 *
 * Call this after scoring an application.
 */
export async function checkAndAutoAdvance(
  applicationId: string
): Promise<AutoAdvanceResult> {
  // Fetch application with job settings and current stage
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      aiScore: true,
      stageId: true,
      status: true,
      stage: {
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
      candidate: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
          autoAdvanceEnabled: true,
          autoAdvanceMinScore: true,
          autoAdvanceToStageId: true,
          autoAdvanceToStage: {
            select: {
              id: true,
              name: true,
              order: true,
            },
          },
          stages: {
            select: {
              id: true,
              name: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!application) {
    return {
      advanced: false,
      applicationId,
      reason: 'Application not found',
    };
  }

  const { job, aiScore, stage } = application;

  // Check if auto-advance is enabled for this job
  if (!job.autoAdvanceEnabled) {
    return {
      advanced: false,
      applicationId,
      reason: 'Auto-advance not enabled for this job',
    };
  }

  // Check if application has been scored
  if (aiScore === null) {
    return {
      advanced: false,
      applicationId,
      reason: 'Application not scored yet',
    };
  }

  // Check if score meets threshold
  if (aiScore < job.autoAdvanceMinScore) {
    return {
      advanced: false,
      applicationId,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
      reason: `Score ${aiScore} below threshold ${job.autoAdvanceMinScore}`,
    };
  }

  // Only auto-advance from the first stage (Application Review)
  // This prevents auto-advancing candidates who are already further in the pipeline
  const firstStage = job.stages[0];
  if (!firstStage || stage?.order !== firstStage.order) {
    return {
      advanced: false,
      applicationId,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
      fromStage: stage?.name,
      reason: `Application not in first stage (${firstStage?.name || 'unknown'})`,
    };
  }

  // Determine target stage (configured stage or second stage)
  let targetStage = job.autoAdvanceToStage;
  if (!targetStage) {
    // Default to second stage if no specific stage configured
    targetStage = job.stages[1];
  }

  if (!targetStage) {
    return {
      advanced: false,
      applicationId,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
      reason: 'No target stage configured and job has only one stage',
    };
  }

  // Check if application is still active
  if (application.status !== 'ACTIVE') {
    return {
      advanced: false,
      applicationId,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
      reason: `Application status is ${application.status}, not ACTIVE`,
    };
  }

  // Perform the auto-advance
  try {
    // Update application stage
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        stageId: targetStage.id,
        updatedAt: new Date(),
      },
    });

    // Create stage history entry
    await prisma.stageHistory.create({
      data: {
        applicationId,
        stageId: targetStage.id,
      },
    });

    // Log the auto-advance activity
    await ActivityLogger.stageChange({
      applicationId,
      userId: 'system', // Auto-advance is system-initiated
      fromStage: stage?.name || 'Unknown',
      toStage: targetStage.name,
      candidateName: `${application.candidate.firstName} ${application.candidate.lastName}`,
      isAutomated: true,
      automationReason: `AI score ${aiScore} meets threshold ${job.autoAdvanceMinScore}`,
    });

    // Execute stage rules for the transition
    if (stage?.id) {
      await executeStageRules(applicationId, stage.id, 'onExit').catch(console.error);
    }
    await executeStageRules(applicationId, targetStage.id, 'onEnter').catch(console.error);

    return {
      advanced: true,
      applicationId,
      fromStage: stage?.name,
      toStage: targetStage.name,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
    };
  } catch (error) {
    console.error(`[Auto-advance] Failed to advance application ${applicationId}:`, error);
    return {
      advanced: false,
      applicationId,
      score: aiScore,
      threshold: job.autoAdvanceMinScore,
      reason: `Failed to advance: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Batch check and auto-advance multiple applications
 * Useful after bulk scoring
 */
export async function checkAndAutoAdvanceBatch(
  applicationIds: string[],
  options?: {
    onProgress?: (completed: number, total: number, result: AutoAdvanceResult) => void;
  }
): Promise<AutoAdvanceResult[]> {
  const results: AutoAdvanceResult[] = [];

  for (let i = 0; i < applicationIds.length; i++) {
    const result = await checkAndAutoAdvance(applicationIds[i]);
    results.push(result);
    options?.onProgress?.(i + 1, applicationIds.length, result);
  }

  return results;
}
