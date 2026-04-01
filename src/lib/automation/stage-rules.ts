import { prisma } from '../prisma';
import { sendBrandedEmail } from '../postmark';
import { generateToken, hashToken, applicationTokenExpiresAt } from '../tokens';

export type StageRuleTrigger = 'onEnter' | 'onExit' | 'onSlaBreach';
export type StageRuleAction = 'sendEmail' | 'createTask' | 'setSla' | 'tagCandidate' | 'startSequence';

export interface StageRuleConfig {
  trigger: StageRuleTrigger;
  actionType: StageRuleAction;
  emailTemplateId?: string;
  taskTemplate?: {
    title: string;
    description?: string;
    assigneeId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDays?: number;
  };
  slaOverride?: {
    targetDays: number;
    warningDays: number;
  };
  tags?: string[];
  sequenceId?: string;
}

export async function executeStageRules(
  applicationId: string,
  stageId: string,
  trigger: StageRuleTrigger
) {
  const rules = await prisma.stageRule.findMany({
    where: {
      stageId,
      trigger,
      isActive: true
    },
    include: {
      emailTemplate: true,
      sequence: true
    },
    orderBy: { order: 'asc' }
  });

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: true,
      job: true,
      stage: true
    }
  });

  if (!application) return;

  for (const rule of rules) {
    try {
      // Use enum-based action type if available, fall back to legacy string
      const action = rule.actionTypeEnum || rule.actionType;

      switch (action) {
        case 'sendEmail':
        case 'SEND_EMAIL':
          if (rule.emailTemplate) {
            await sendEmailFromTemplate(application, rule.emailTemplate);
          }
          break;
        case 'SEND_SCHEDULING_LINK':
          await sendSchedulingLinkEmail(application);
          break;
        case 'createTask':
        case 'CREATE_TASK':
          if (rule.taskTemplate) {
            const taskTemplate = rule.taskTemplate as {
              title: string;
              description?: string;
              assigneeId?: string;
              priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
              dueDays?: number;
            };
            await createTaskFromTemplate(application, taskTemplate);
          }
          break;
        case 'setSla':
        case 'SET_SLA':
          if (rule.slaOverride) {
            const slaOverride = rule.slaOverride as { targetDays: number; warningDays: number };
            await setSlaForApplication(applicationId, stageId, slaOverride);
          }
          break;
        case 'tagCandidate':
        case 'TAG_CANDIDATE':
          if (rule.tags && rule.tags.length > 0) {
            await tagCandidate(application.candidateId, rule.tags);
          }
          break;
        case 'startSequence':
        case 'START_SEQUENCE':
          if (rule.sequenceId) {
            await startSequence(applicationId, rule.sequenceId);
          }
          break;
      }
    } catch (error) {
      console.error(`Error executing rule ${rule.id}:`, error);
      // Continue with other rules even if one fails
    }
  }
}

async function sendEmailFromTemplate(application: any, template: any) {
  const body = replaceMergeFields(template.body, application);
  const subject = replaceMergeFields(template.subject, application);
  
  const sendResult = await sendBrandedEmail({
    to: application.candidate.email,
    subject,
    htmlBody: body,
    from: 'RECRUITING',
  });

  // Log the email
  await prisma.messageLog.create({
    data: {
      applicationId: application.id,
      type: 'EMAIL',
      recipient: application.candidate.email,
      subject,
      body,
      postmarkMessageId: sendResult?.MessageID || null,
    }
  });
}

async function sendSchedulingLinkEmail(application: any) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiring.acmetalent.com';

  // Generate an additional portal token for the email link
  // Uses create (not upsert) so existing tokens remain valid
  const rawToken = generateToken();
  await prisma.applicationToken.create({
    data: {
      applicationId: application.id,
      token: hashToken(rawToken),
      expiresAt: applicationTokenExpiresAt(),
    },
  });

  const statusUrl = `${baseUrl}/status/${rawToken}`;

  // Look for a SCHEDULING_LINK email template
  const schedulingTemplate = await prisma.emailTemplate.findFirst({
    where: { type: 'SCHEDULING_LINK' },
    orderBy: { updatedAt: 'desc' },
  });

  if (schedulingTemplate) {
    // Use the template with full merge field replacement
    const mergeData: Record<string, string> = {
      '{{CANDIDATE_FIRST_NAME}}': application.candidate.firstName || '',
      '{{CANDIDATE_LAST_NAME}}': application.candidate.lastName || '',
      '{{CANDIDATE_NAME}}': `${application.candidate.firstName} ${application.candidate.lastName}`.trim(),
      '{{JOB_NAME}}': application.job.title || '',
      '{{COMPANY}}': 'Acme Talent',
      '{{SCHEDULING_LINK}}': statusUrl,
      '{{AVAILABILITY_SUBMISSION_LINK}}': statusUrl,
      '{{STAGE_NAME}}': application.stage?.name || '',
    };

    let subject = schedulingTemplate.subject;
    let body = schedulingTemplate.body;
    for (const [field, value] of Object.entries(mergeData)) {
      const escaped = field.replace(/[{}]/g, '\\$&');
      subject = subject.replace(new RegExp(escaped, 'g'), value);
      body = body.replace(new RegExp(escaped, 'g'), value);
    }

    const sendResult = await sendBrandedEmail({
      to: application.candidate.email,
      subject,
      htmlBody: body,
      from: 'RECRUITING',
    });

    await prisma.messageLog.create({
      data: {
        applicationId: application.id,
        type: 'EMAIL',
        recipient: application.candidate.email,
        subject,
        body,
        status: 'SENT',
        postmarkMessageId: sendResult?.MessageID || null,
      },
    });
  } else {
    // Fallback: send a branded scheduling link email using stage name
    const candidateName = application.candidate.firstName;
    const jobTitle = application.job.title;
    const stageName = application.stage?.name || 'interview';
    // Use stage name in subject/body (e.g. "Preliminary Phone Screen" → "phone screen")
    const stageLabel = stageName.toLowerCase().replace(/^\d+\.\s*/, '').trim();
    const subject = `Schedule Your ${stageName} — ${jobTitle}`;
    const body = `
      <h1 style="margin: 0 0 20px; font-size: 24px; color: #2D3E6F;">Next Step: ${stageName}</h1>
      <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">Hi ${candidateName},</p>
      <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">We'd like to schedule a ${stageLabel} with you for the <strong style="color: #2D3E6F;">${jobTitle}</strong> position at Acme Talent.</p>
      <p style="margin: 0 0 15px; font-size: 16px; color: #333; line-height: 1.6;">Please use the link below to select a time that works for you:</p>
      <p style="margin: 20px 0;"><a href="${statusUrl}" style="display:inline-block;padding:14px 28px;background-color:#3BA9DA;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;">Schedule Your ${stageName}</a></p>
      <p style="margin: 15px 0; font-size: 16px; color: #333; line-height: 1.6;">If you have any questions, feel free to reply to this email.</p>
      <p style="margin: 30px 0 0; font-size: 16px; color: #333;">Best,<br/><span style="color: #2D3E6F; font-weight: 500;">Acme Talent Recruiting Team</span></p>
    `;

    const sendResult = await sendBrandedEmail({
      to: application.candidate.email,
      subject,
      htmlBody: body,
      from: 'RECRUITING',
    });

    await prisma.messageLog.create({
      data: {
        applicationId: application.id,
        type: 'EMAIL',
        recipient: application.candidate.email,
        subject,
        body,
        status: 'SENT',
        postmarkMessageId: sendResult?.MessageID || null,
      },
    });
  }
}

async function createTaskFromTemplate(application: any, template: any) {
  const dueAt = template.dueDays
    ? new Date(Date.now() + template.dueDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.task.create({
    data: {
      applicationId: application.id,
      jobId: application.jobId,
      stageId: application.stageId,
      title: replaceMergeFields(template.title, application),
      description: template.description ? replaceMergeFields(template.description, application) : null,
      assigneeId: template.assigneeId || application.job.marketId, // Fallback to market admin
      priority: template.priority || 'MEDIUM',
      dueAt
    }
  });
}

async function setSlaForApplication(applicationId: string, stageId: string, slaOverride: { targetDays: number; warningDays: number }) {
  // Check if SLA config exists for this stage
  let slaConfig = await prisma.slaConfig.findUnique({
    where: { stageId }
  });

  if (!slaConfig) {
    slaConfig = await prisma.slaConfig.create({
      data: {
        stageId,
        targetDays: slaOverride.targetDays,
        warningDays: slaOverride.warningDays
      }
    });
  } else {
    slaConfig = await prisma.slaConfig.update({
      where: { id: slaConfig.id },
      data: {
        targetDays: slaOverride.targetDays,
        warningDays: slaOverride.warningDays
      }
    });
  }
}

async function tagCandidate(candidateId: string, tags: string[]) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { tags: true }
  });

  if (candidate) {
    const updatedTags = [...new Set([...candidate.tags, ...tags])];
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { tags: updatedTags }
    });
  }
}

async function startSequence(applicationId: string, sequenceId: string) {
  const sequence = await prisma.sequence.findUnique({
    where: { id: sequenceId },
    select: { steps: true }
  });

  if (!sequence) return;

  const steps = sequence.steps as Array<{ delay: number; templateId: string; cancelOnReply: boolean }>;
  const firstStep = steps[0];
  const nextSendAt = firstStep ? new Date(Date.now() + firstStep.delay * 24 * 60 * 60 * 1000) : null;

  await prisma.sequenceInstance.create({
    data: {
      sequenceId,
      applicationId,
      status: 'ACTIVE',
      currentStep: 0,
      nextSendAt
    }
  });
}

function replaceMergeFields(text: string, application: any): string {
  return text
    .replace(/\{\{candidate\.firstName\}\}/g, application.candidate.firstName)
    .replace(/\{\{candidate\.lastName\}\}/g, application.candidate.lastName)
    .replace(/\{\{candidate\.email\}\}/g, application.candidate.email)
    .replace(/\{\{job\.title\}\}/g, application.job.title)
    .replace(/\{\{stage\.name\}\}/g, application.stage.name)
    .replace(/\{\{application\.id\}\}/g, application.id);
}

