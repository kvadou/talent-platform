import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { JobNotificationType } from '@prisma/client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const notifications = await prisma.jobNotificationConfig.findMany({
    where: { jobId },
    orderBy: { type: 'asc' },
  });

  return NextResponse.json({ notifications });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { type, isEnabled, recipients, timing } = await req.json();

  if (!type) {
    return NextResponse.json({ error: 'Type is required' }, { status: 400 });
  }

  // Upsert the notification config
  const config = await prisma.jobNotificationConfig.upsert({
    where: {
      jobId_type: { jobId, type: type as JobNotificationType },
    },
    update: {
      ...(typeof isEnabled === 'boolean' && { isEnabled }),
      ...(recipients && { recipients }),
      ...(timing !== undefined && { timing }),
    },
    create: {
      jobId,
      type: type as JobNotificationType,
      isEnabled: isEnabled ?? true,
      recipients: recipients ?? ['hiring_managers', 'recruiters'],
      timing: timing ?? null,
    },
  });

  return NextResponse.json(config);
}
