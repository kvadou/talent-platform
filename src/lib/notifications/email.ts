import { sendEmail } from '@/lib/postmark';
import { applicationReceivedTemplate, newApplicationNotification, stageMovedTemplate, interviewScheduledTemplate, hireTemplate, rejectTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';

export async function sendApplicationReceived(to: string, candidateName: string, jobTitle: string) {
  const [firstName, ...rest] = candidateName.split(' ');
  const lastName = rest.join(' ');
  const mergeData = buildMergeData({
    candidate: { firstName, lastName, email: to },
    job: { title: jobTitle },
  });
  const dbTpl = await resolveTemplate('APPLICATION_RECEIVED', mergeData);
  const tpl = dbTpl || applicationReceivedTemplate(candidateName, jobTitle);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}

export async function sendNewApplicationToRecruiter(to: string, jobTitle: string) {
  const tpl = newApplicationNotification(jobTitle);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}

export async function sendStageMoved(to: string, candidateName: string, stage: string) {
  const [firstName, ...rest] = candidateName.split(' ');
  const lastName = rest.join(' ');
  const mergeData = buildMergeData({
    candidate: { firstName, lastName, email: to },
    stage: { name: stage },
  });
  const dbTpl = await resolveTemplate('STAGE_CHANGE', mergeData);
  const tpl = dbTpl || stageMovedTemplate(candidateName, stage);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}

export async function sendInterviewScheduled(to: string, candidateName: string, when: string, location?: string, meetingLink?: string) {
  const [firstName, ...rest] = candidateName.split(' ');
  const lastName = rest.join(' ');
  const mergeData = buildMergeData({
    candidate: { firstName, lastName, email: to },
    interview: {
      date: when,
      location: location || undefined,
      meetingLink: meetingLink || undefined,
    },
  });
  const dbTpl = await resolveTemplate('INTERVIEW_CONFIRMATION', mergeData);
  const tpl = dbTpl || interviewScheduledTemplate(candidateName, when, location, meetingLink);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}

export async function sendHire(to: string, candidateName: string) {
  const [firstName, ...rest] = candidateName.split(' ');
  const lastName = rest.join(' ');
  const mergeData = buildMergeData({
    candidate: { firstName, lastName, email: to },
  });
  const dbTpl = await resolveTemplate('OFFER_ACCEPTED', mergeData);
  const tpl = dbTpl || hireTemplate(candidateName);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}

export async function sendReject(to: string, candidateName: string) {
  const [firstName, ...rest] = candidateName.split(' ');
  const lastName = rest.join(' ');
  const mergeData = buildMergeData({
    candidate: { firstName, lastName, email: to },
  });
  const dbTpl = await resolveTemplate('APPLICATION_REJECTION', mergeData);
  const tpl = dbTpl || rejectTemplate(candidateName);
  await sendEmail({ to, subject: tpl.subject, htmlBody: tpl.html });
}
