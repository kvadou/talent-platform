import { prisma } from '../prisma';
import { sendEmail } from '../postmark';

export async function processSequences() {
  const now = new Date();
  
  // Find sequences ready to send
  const readyInstances = await prisma.sequenceInstance.findMany({
    where: {
      status: 'ACTIVE',
      nextSendAt: {
        lte: now
      }
    },
    include: {
      sequence: {
        select: {
          steps: true,
          isActive: true
        }
      },
      application: {
        include: {
          candidate: true,
          job: true,
          stage: true
        }
      }
    }
  });

  for (const instance of readyInstances) {
    if (!instance.sequence.isActive) {
      await prisma.sequenceInstance.update({
        where: { id: instance.id },
        data: { status: 'CANCELLED', cancelledAt: now }
      });
      continue;
    }

    const steps = instance.sequence.steps as Array<{
      delay: number;
      templateId: string;
      cancelOnReply: boolean;
    }>;

    const currentStep = steps[instance.currentStep];
    if (!currentStep) {
      // Sequence complete
      await prisma.sequenceInstance.update({
        where: { id: instance.id },
        data: { status: 'COMPLETED', completedAt: now }
      });
      continue;
    }

    // Get email template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: currentStep.templateId }
    });

    if (!template) {
      console.error(`Template ${currentStep.templateId} not found for sequence instance ${instance.id}`);
      continue;
    }

    // Send email
    try {
      const body = replaceMergeFields(template.body, instance.application);
      const subject = replaceMergeFields(template.subject, instance.application);

      const sendResult = await sendEmail({
        to: instance.application.candidate.email,
        subject,
        htmlBody: body
      });

      // Log the email
      await prisma.messageLog.create({
        data: {
          applicationId: instance.application.id,
          type: 'EMAIL',
          recipient: instance.application.candidate.email,
          subject,
          body,
          postmarkMessageId: sendResult?.MessageID || null,
        }
      });

      // Check if we should cancel on reply (would need to check message logs)
      // For now, just move to next step
      const nextStepIndex = instance.currentStep + 1;
      const nextStep = steps[nextStepIndex];

      if (nextStep) {
        const nextSendAt = new Date(now.getTime() + nextStep.delay * 24 * 60 * 60 * 1000);
        await prisma.sequenceInstance.update({
          where: { id: instance.id },
          data: {
            currentStep: nextStepIndex,
            nextSendAt
          }
        });
      } else {
        // Sequence complete
        await prisma.sequenceInstance.update({
          where: { id: instance.id },
          data: { status: 'COMPLETED', completedAt: now }
        });
      }
    } catch (error) {
      console.error(`Error sending sequence email for instance ${instance.id}:`, error);
      // Continue processing other instances
    }
  }
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

