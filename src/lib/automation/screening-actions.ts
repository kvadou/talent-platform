import { prisma } from '@/lib/prisma';
import { ActivityLogger } from '@/lib/activity-logger';
import { executeStageRules } from './stage-rules';

export interface ScreeningActionResult {
  action: 'advanced' | 'rejected' | 'on_hold' | 'at_final_stage' | 'no_decision' | 'not_active' | 'unknown_decision';
  applicationId: string;
  fromStage?: string;
  toStage?: string;
}

/**
 * Process the result of a completed screening session.
 * Called after a screening session is completed (either by AI or human reviewer).
 *
 * Determines the decision (prefers human over AI), then:
 * - ADVANCE / SCHEDULE_CALL: moves application to the next pipeline stage
 * - REJECT: sets application status to REJECTED
 * - HOLD: logs a hold, no stage/status change
 */
export async function processScreeningResult(
  sessionId: string
): Promise<ScreeningActionResult> {
  const session = await prisma.aIScreeningSession.findUnique({
    where: { id: sessionId },
    include: {
      application: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true },
          },
          job: {
            include: {
              stages: { orderBy: { order: 'asc' } },
            },
          },
          stage: true,
        },
      },
    },
  });

  if (!session) throw new Error('Screening session not found');

  const application = session.application;
  const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;

  // Prefer human decision over AI recommendation
  const decision = session.humanDecision || session.aiRecommendation;

  if (!decision) {
    return { action: 'no_decision', applicationId: application.id };
  }

  // Only act on ACTIVE applications
  if (application.status !== 'ACTIVE') {
    return { action: 'not_active', applicationId: application.id };
  }

  const decisionSource = session.humanDecision ? 'human review' : 'AI screening';

  switch (decision) {
    case 'ADVANCE':
    case 'SCHEDULE_CALL': {
      const currentStageOrder = application.stage.order;
      const nextStage = application.job.stages.find(
        (s) => s.order > currentStageOrder
      );

      if (!nextStage) {
        await ActivityLogger.stageChange({
          applicationId: application.id,
          userId: 'system',
          fromStage: application.stage.name,
          toStage: application.stage.name,
          candidateName,
          isAutomated: true,
          automationReason: `Screening (${decisionSource}) recommended advancement but candidate is already at the final stage.`,
        });
        return { action: 'at_final_stage', applicationId: application.id };
      }

      // Advance to next stage
      await prisma.application.update({
        where: { id: application.id },
        data: {
          stageId: nextStage.id,
          updatedAt: new Date(),
        },
      });

      // Record stage history
      await prisma.stageHistory.create({
        data: {
          applicationId: application.id,
          stageId: nextStage.id,
          movedBy: 'AI Screening',
        },
      });

      // Log activity via ActivityLogger (consistent with auto-advance.ts)
      await ActivityLogger.stageChange({
        applicationId: application.id,
        userId: 'system',
        fromStage: application.stage.name,
        toStage: nextStage.name,
        candidateName,
        isAutomated: true,
        automationReason: `Screening (${decisionSource}) recommended ${decision === 'SCHEDULE_CALL' ? 'scheduling a call' : 'advancement'}`,
      });

      // Execute stage rules for the transition
      await executeStageRules(application.id, application.stage.id, 'onExit').catch(console.error);
      await executeStageRules(application.id, nextStage.id, 'onEnter').catch(console.error);

      return {
        action: 'advanced',
        applicationId: application.id,
        fromStage: application.stage.name,
        toStage: nextStage.name,
      };
    }

    case 'REJECT': {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: 'REJECTED', updatedAt: new Date() },
      });

      await ActivityLogger.statusChange({
        applicationId: application.id,
        userId: 'system',
        candidateName,
        fromStatus: 'ACTIVE',
        toStatus: 'REJECTED',
      });

      return { action: 'rejected', applicationId: application.id };
    }

    case 'HOLD': {
      await ActivityLogger.stageChange({
        applicationId: application.id,
        userId: 'system',
        fromStage: application.stage.name,
        toStage: application.stage.name,
        candidateName,
        isAutomated: true,
        automationReason: `Screening (${decisionSource}) placed application on hold pending further review.`,
      });

      return { action: 'on_hold', applicationId: application.id };
    }

    default:
      return { action: 'unknown_decision', applicationId: application.id };
  }
}
