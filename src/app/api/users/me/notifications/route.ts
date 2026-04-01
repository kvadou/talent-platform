import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/users/me/notifications - Get current user's notification preferences
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { notificationPrefs: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If no preferences exist, return defaults
    if (!user.notificationPrefs) {
      return NextResponse.json({
        notifications: getDefaultPreferences(),
      });
    }

    // Transform DB format to frontend format
    const notifications = transformPrefsToFrontend(user.notificationPrefs);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

// PUT /api/users/me/notifications - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { notifications } = body;

    if (!notifications || !Array.isArray(notifications)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Transform frontend format to DB format
    const dbData = transformPrefsToDb(notifications);

    // Upsert the preferences
    const prefs = await prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      update: dbData,
      create: {
        userId: user.id,
        ...dbData,
      },
    });

    // Transform back to frontend format
    const updatedNotifications = transformPrefsToFrontend(prefs);
    return NextResponse.json({ notifications: updatedNotifications });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}

// Helper functions

type NotificationSetting = {
  id: string;
  name: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
  category: string;
};

function getDefaultPreferences(): NotificationSetting[] {
  return [
    // Applications
    {
      id: 'new_application',
      name: 'New Application',
      description: 'When a candidate applies to a job',
      email: true,
      push: true,
      sms: false,
      category: 'Applications',
    },
    {
      id: 'application_update',
      name: 'Application Stage Change',
      description: 'When an application moves to a new stage',
      email: true,
      push: false,
      sms: false,
      category: 'Applications',
    },
    // Interviews
    {
      id: 'interview_scheduled',
      name: 'Interview Scheduled',
      description: 'When an interview is scheduled',
      email: true,
      push: true,
      sms: false,
      category: 'Interviews',
    },
    {
      id: 'interview_reminder',
      name: 'Interview Reminder',
      description: 'Reminder before upcoming interviews',
      email: true,
      push: true,
      sms: true,
      category: 'Interviews',
    },
    {
      id: 'interview_feedback',
      name: 'Interview Feedback Submitted',
      description: 'When feedback is submitted for an interview',
      email: true,
      push: false,
      sms: false,
      category: 'Interviews',
    },
    // Tasks
    {
      id: 'task_assigned',
      name: 'Task Assigned',
      description: 'When a task is assigned to you',
      email: true,
      push: true,
      sms: false,
      category: 'Tasks',
    },
    {
      id: 'task_due',
      name: 'Task Due Soon',
      description: 'Reminder when a task is due',
      email: true,
      push: true,
      sms: false,
      category: 'Tasks',
    },
    // Offers
    {
      id: 'offer_created',
      name: 'Offer Created',
      description: 'When a new offer is created',
      email: true,
      push: false,
      sms: false,
      category: 'Offers',
    },
    {
      id: 'offer_accepted',
      name: 'Offer Accepted',
      description: 'When a candidate accepts an offer',
      email: true,
      push: true,
      sms: true,
      category: 'Offers',
    },
    {
      id: 'offer_declined',
      name: 'Offer Declined',
      description: 'When a candidate declines an offer',
      email: true,
      push: true,
      sms: false,
      category: 'Offers',
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPrefsToFrontend(prefs: any): NotificationSetting[] {
  return [
    // Applications
    {
      id: 'new_application',
      name: 'New Application',
      description: 'When a candidate applies to a job',
      email: prefs.newApplicationEmail,
      push: prefs.newApplicationPush,
      sms: prefs.newApplicationSms,
      category: 'Applications',
    },
    {
      id: 'application_update',
      name: 'Application Stage Change',
      description: 'When an application moves to a new stage',
      email: prefs.applicationUpdateEmail,
      push: prefs.applicationUpdatePush,
      sms: prefs.applicationUpdateSms,
      category: 'Applications',
    },
    // Interviews
    {
      id: 'interview_scheduled',
      name: 'Interview Scheduled',
      description: 'When an interview is scheduled',
      email: prefs.interviewScheduledEmail,
      push: prefs.interviewScheduledPush,
      sms: prefs.interviewScheduledSms,
      category: 'Interviews',
    },
    {
      id: 'interview_reminder',
      name: 'Interview Reminder',
      description: 'Reminder before upcoming interviews',
      email: prefs.interviewReminderEmail,
      push: prefs.interviewReminderPush,
      sms: prefs.interviewReminderSms,
      category: 'Interviews',
    },
    {
      id: 'interview_feedback',
      name: 'Interview Feedback Submitted',
      description: 'When feedback is submitted for an interview',
      email: prefs.interviewFeedbackEmail,
      push: prefs.interviewFeedbackPush,
      sms: prefs.interviewFeedbackSms,
      category: 'Interviews',
    },
    // Tasks
    {
      id: 'task_assigned',
      name: 'Task Assigned',
      description: 'When a task is assigned to you',
      email: prefs.taskAssignedEmail,
      push: prefs.taskAssignedPush,
      sms: prefs.taskAssignedSms,
      category: 'Tasks',
    },
    {
      id: 'task_due',
      name: 'Task Due Soon',
      description: 'Reminder when a task is due',
      email: prefs.taskDueEmail,
      push: prefs.taskDuePush,
      sms: prefs.taskDueSms,
      category: 'Tasks',
    },
    // Offers
    {
      id: 'offer_created',
      name: 'Offer Created',
      description: 'When a new offer is created',
      email: prefs.offerCreatedEmail,
      push: prefs.offerCreatedPush,
      sms: prefs.offerCreatedSms,
      category: 'Offers',
    },
    {
      id: 'offer_accepted',
      name: 'Offer Accepted',
      description: 'When a candidate accepts an offer',
      email: prefs.offerAcceptedEmail,
      push: prefs.offerAcceptedPush,
      sms: prefs.offerAcceptedSms,
      category: 'Offers',
    },
    {
      id: 'offer_declined',
      name: 'Offer Declined',
      description: 'When a candidate declines an offer',
      email: prefs.offerDeclinedEmail,
      push: prefs.offerDeclinedPush,
      sms: prefs.offerDeclinedSms,
      category: 'Offers',
    },
  ];
}

function transformPrefsToDb(notifications: NotificationSetting[]) {
  const prefs: Record<string, boolean> = {};

  for (const n of notifications) {
    switch (n.id) {
      case 'new_application':
        prefs.newApplicationEmail = n.email;
        prefs.newApplicationPush = n.push;
        prefs.newApplicationSms = n.sms;
        break;
      case 'application_update':
        prefs.applicationUpdateEmail = n.email;
        prefs.applicationUpdatePush = n.push;
        prefs.applicationUpdateSms = n.sms;
        break;
      case 'interview_scheduled':
        prefs.interviewScheduledEmail = n.email;
        prefs.interviewScheduledPush = n.push;
        prefs.interviewScheduledSms = n.sms;
        break;
      case 'interview_reminder':
        prefs.interviewReminderEmail = n.email;
        prefs.interviewReminderPush = n.push;
        prefs.interviewReminderSms = n.sms;
        break;
      case 'interview_feedback':
        prefs.interviewFeedbackEmail = n.email;
        prefs.interviewFeedbackPush = n.push;
        prefs.interviewFeedbackSms = n.sms;
        break;
      case 'task_assigned':
        prefs.taskAssignedEmail = n.email;
        prefs.taskAssignedPush = n.push;
        prefs.taskAssignedSms = n.sms;
        break;
      case 'task_due':
        prefs.taskDueEmail = n.email;
        prefs.taskDuePush = n.push;
        prefs.taskDueSms = n.sms;
        break;
      case 'offer_created':
        prefs.offerCreatedEmail = n.email;
        prefs.offerCreatedPush = n.push;
        prefs.offerCreatedSms = n.sms;
        break;
      case 'offer_accepted':
        prefs.offerAcceptedEmail = n.email;
        prefs.offerAcceptedPush = n.push;
        prefs.offerAcceptedSms = n.sms;
        break;
      case 'offer_declined':
        prefs.offerDeclinedEmail = n.email;
        prefs.offerDeclinedPush = n.push;
        prefs.offerDeclinedSms = n.sms;
        break;
    }
  }

  return prefs;
}
