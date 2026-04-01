import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/postmark';
import { interviewReminderTemplate } from '@/lib/email-templates';
import { resolveTemplate, buildMergeData } from '@/lib/email-templates/resolve';
import crypto from 'crypto';

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  let remindersSent = 0;
  let errors = 0;

  // Find interviews scheduled for approximately 24 hours from now (23-25 hours window)
  const twentyFourHourWindow = await prisma.interview.findMany({
    where: {
      scheduledAt: {
        gte: new Date(twentyFourHoursFromNow.getTime() - 60 * 60 * 1000), // 23 hours from now
        lte: new Date(twentyFourHoursFromNow.getTime() + 60 * 60 * 1000)  // 25 hours from now
      },
      reminderSent: false
    },
    include: {
      application: {
        include: {
          candidate: true
        }
      }
    }
  });

  // Find interviews scheduled for approximately 1 hour from now (0.5-1.5 hours window)
  const oneHourWindow = await prisma.interview.findMany({
    where: {
      scheduledAt: {
        gte: new Date(oneHourFromNow.getTime() - 30 * 60 * 1000), // 30 minutes from now
        lte: new Date(oneHourFromNow.getTime() + 30 * 60 * 1000)  // 1.5 hours from now
      },
      reminderSent: false
    },
    include: {
      application: {
        include: {
          candidate: true
        }
      }
    }
  });

  // Send 24-hour reminders
  for (const interview of twentyFourHourWindow) {
    try {
      const candidateTimezone = interview.application.candidate.timezone || 'America/New_York';
      const typeLabel = interview.type.replace(/_/g, ' ');
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        timeZone: candidateTimezone,
      }).format(interview.scheduledAt);
      const formattedTime = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        timeZone: candidateTimezone,
      }).format(interview.scheduledAt);

      const mergeData = buildMergeData({
        candidate: { firstName: interview.application.candidate.firstName, email: interview.application.candidate.email },
        interview: {
          type: typeLabel,
          date: formattedDate,
          time: formattedTime,
          duration: interview.duration,
          location: interview.location || undefined,
          meetingLink: interview.meetingLink || undefined,
        },
      });
      const dbTemplate = await resolveTemplate('INTERVIEW_REMINDER', mergeData);
      const emailTemplate = dbTemplate || interviewReminderTemplate(
        interview.application.candidate.firstName,
        typeLabel,
        interview.scheduledAt.toISOString(),
        interview.duration,
        24,
        interview.location || undefined,
        interview.meetingLink || undefined,
        candidateTimezone
      );

      const emailResult = await sendEmail({
        to: interview.application.candidate.email,
        subject: emailTemplate.subject,
        htmlBody: emailTemplate.html
      });

      // Log the email
      await prisma.messageLog.create({
        data: {
          applicationId: interview.applicationId,
          type: 'EMAIL',
          recipient: interview.application.candidate.email,
          subject: emailTemplate.subject,
          body: emailTemplate.html,
          status: 'SENT',
          postmarkMessageId: emailResult.MessageID
        }
      });

      remindersSent++;
    } catch (error) {
      console.error(`Failed to send 24h reminder for interview ${interview.id}:`, error);
      errors++;
    }
  }

  // Send 1-hour reminders
  for (const interview of oneHourWindow) {
    try {
      const candidateTimezone = interview.application.candidate.timezone || 'America/New_York';
      const typeLabel = interview.type.replace(/_/g, ' ');
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        timeZone: candidateTimezone,
      }).format(interview.scheduledAt);
      const formattedTime = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        timeZone: candidateTimezone,
      }).format(interview.scheduledAt);

      const mergeData = buildMergeData({
        candidate: { firstName: interview.application.candidate.firstName, email: interview.application.candidate.email },
        interview: {
          type: typeLabel,
          date: formattedDate,
          time: formattedTime,
          duration: interview.duration,
          location: interview.location || undefined,
          meetingLink: interview.meetingLink || undefined,
        },
      });
      const dbTemplate = await resolveTemplate('INTERVIEW_REMINDER', mergeData);
      const emailTemplate = dbTemplate || interviewReminderTemplate(
        interview.application.candidate.firstName,
        typeLabel,
        interview.scheduledAt.toISOString(),
        interview.duration,
        1,
        interview.location || undefined,
        interview.meetingLink || undefined,
        candidateTimezone
      );

      const emailResult = await sendEmail({
        to: interview.application.candidate.email,
        subject: emailTemplate.subject,
        htmlBody: emailTemplate.html
      });

      // Log the email
      await prisma.messageLog.create({
        data: {
          applicationId: interview.applicationId,
          type: 'EMAIL',
          recipient: interview.application.candidate.email,
          subject: emailTemplate.subject,
          body: emailTemplate.html,
          status: 'SENT',
          postmarkMessageId: emailResult.MessageID
        }
      });

      // Mark reminder as sent (only after 1-hour reminder, not 24-hour)
      await prisma.interview.update({
        where: { id: interview.id },
        data: { reminderSent: true }
      });

      remindersSent++;
    } catch (error) {
      console.error(`Failed to send 1h reminder for interview ${interview.id}:`, error);
      errors++;
    }
  }

  return NextResponse.json({
    message: 'Interview reminders processed',
    remindersSent,
    errors,
    twentyFourHourReminders: twentyFourHourWindow.length,
    oneHourReminders: oneHourWindow.length
  });
}
