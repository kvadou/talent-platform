import { prisma } from '@/lib/prisma';
import { ActivityType, Prisma } from '@prisma/client';

type LogActivityParams = {
  applicationId?: string;
  candidateId?: string;
  userId?: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Log an activity event for tracking application/candidate history
 */
export async function logActivity({
  applicationId,
  candidateId,
  userId,
  type,
  title,
  description,
  metadata,
}: LogActivityParams) {
  return prisma.activityLog.create({
    data: {
      applicationId,
      candidateId,
      userId,
      type,
      title,
      description,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
}

/**
 * Helper functions for common activity types
 */
export const ActivityLogger = {
  async stageChange(params: {
    applicationId: string;
    userId: string;
    fromStage: string;
    toStage: string;
    candidateName: string;
    isAutomated?: boolean;
    automationReason?: string;
  }) {
    const isAutoAdvance = params.isAutomated && params.userId === 'system';
    return logActivity({
      applicationId: params.applicationId,
      userId: params.isAutomated ? undefined : params.userId,
      type: 'STAGE_CHANGE',
      title: isAutoAdvance
        ? `${params.candidateName} auto-advanced to ${params.toStage}`
        : `${params.candidateName} moved to ${params.toStage}`,
      description: params.automationReason || `Moved from ${params.fromStage} to ${params.toStage}`,
      metadata: {
        fromStage: params.fromStage,
        toStage: params.toStage,
        isAutomated: params.isAutomated || false,
        automationReason: params.automationReason,
      },
    });
  },

  async emailSent(params: {
    applicationId: string;
    userId?: string;
    recipient: string;
    subject: string;
    candidateName: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'EMAIL_SENT',
      title: `Email sent to ${params.candidateName}`,
      description: `Subject: ${params.subject}`,
      metadata: {
        recipient: params.recipient,
        subject: params.subject,
      },
    });
  },

  async noteAdded(params: {
    applicationId?: string;
    candidateId?: string;
    userId: string;
    isPrivate: boolean;
    authorName: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      candidateId: params.candidateId,
      userId: params.userId,
      type: 'NOTE_ADDED',
      title: `${params.authorName} added a ${params.isPrivate ? 'private ' : ''}note`,
    });
  },

  async interviewScheduled(params: {
    applicationId: string;
    userId: string;
    interviewType: string;
    scheduledAt: Date;
    interviewerName: string;
    candidateName: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'INTERVIEW_SCHEDULED',
      title: `${params.interviewType} scheduled with ${params.interviewerName}`,
      description: `Interview scheduled for ${params.scheduledAt.toLocaleDateString()}`,
      metadata: {
        interviewType: params.interviewType,
        scheduledAt: params.scheduledAt.toISOString(),
        interviewer: params.interviewerName,
      },
    });
  },

  async feedbackSubmitted(params: {
    applicationId: string;
    userId: string;
    interviewerName: string;
    recommendation?: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'FEEDBACK_SUBMITTED',
      title: `${params.interviewerName} submitted feedback`,
      description: params.recommendation ? `Recommendation: ${params.recommendation}` : undefined,
      metadata: {
        recommendation: params.recommendation,
      },
    });
  },

  async offerCreated(params: {
    applicationId: string;
    userId: string;
    candidateName: string;
    compensation: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'OFFER_CREATED',
      title: `Offer created for ${params.candidateName}`,
      description: `Compensation: ${params.compensation}`,
      metadata: {
        compensation: params.compensation,
      },
    });
  },

  async offerSent(params: {
    applicationId: string;
    userId: string;
    candidateName: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'OFFER_SENT',
      title: `Offer sent to ${params.candidateName}`,
    });
  },

  async offerAccepted(params: {
    applicationId: string;
    candidateName: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      type: 'OFFER_ACCEPTED',
      title: `${params.candidateName} accepted the offer`,
    });
  },

  async offerDeclined(params: {
    applicationId: string;
    candidateName: string;
    reason?: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      type: 'OFFER_DECLINED',
      title: `${params.candidateName} declined the offer`,
      description: params.reason,
      metadata: params.reason ? { reason: params.reason } : undefined,
    });
  },

  async taskCreated(params: {
    applicationId?: string;
    candidateId?: string;
    userId: string;
    taskTitle: string;
    assigneeName?: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      candidateId: params.candidateId,
      userId: params.userId,
      type: 'TASK_CREATED',
      title: `Task created: ${params.taskTitle}`,
      description: params.assigneeName ? `Assigned to ${params.assigneeName}` : undefined,
    });
  },

  async taskCompleted(params: {
    applicationId?: string;
    candidateId?: string;
    userId: string;
    taskTitle: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      candidateId: params.candidateId,
      userId: params.userId,
      type: 'TASK_COMPLETED',
      title: `Task completed: ${params.taskTitle}`,
    });
  },

  async applicationCreated(params: {
    applicationId: string;
    candidateId: string;
    candidateName: string;
    jobTitle: string;
    source?: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      candidateId: params.candidateId,
      type: 'APPLICATION_CREATED',
      title: `${params.candidateName} applied to ${params.jobTitle}`,
      description: params.source ? `Source: ${params.source}` : undefined,
      metadata: {
        jobTitle: params.jobTitle,
        source: params.source,
      },
    });
  },

  async statusChange(params: {
    applicationId: string;
    userId: string;
    candidateName: string;
    fromStatus: string;
    toStatus: string;
  }) {
    return logActivity({
      applicationId: params.applicationId,
      userId: params.userId,
      type: 'STATUS_CHANGE',
      title: `${params.candidateName} status changed to ${params.toStatus}`,
      description: `Changed from ${params.fromStatus} to ${params.toStatus}`,
      metadata: {
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
      },
    });
  },
};
