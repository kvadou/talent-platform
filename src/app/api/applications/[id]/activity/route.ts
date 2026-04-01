import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

/**
 * GET /api/applications/[id]/activity
 *
 * Fetches combined activity feed for an application:
 * - ActivityLog entries (stage changes, notes, interviews, offers, etc.)
 * - MessageLog entries (emails sent)
 *
 * Returns unified timeline sorted by timestamp.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { id: applicationId } = await params;

  // Verify access to application
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      ...(access.marketIds
        ? { job: { marketId: { in: access.marketIds } } }
        : {}),
    },
    select: {
      id: true,
      candidateId: true,
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Parse query params
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const filterType = url.searchParams.get('type') || null;

  // Fetch activity logs
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      applicationId,
      ...(filterType ? { type: filterType as never } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  // Fetch message logs (emails sent to candidate)
  const messageLogs = await prisma.messageLog.findMany({
    where: {
      applicationId,
      ...(filterType === 'EMAIL_SENT' ? {} : filterType ? { id: '__never__' } : {}),
    },
    orderBy: { sentAt: 'desc' },
    take: limit,
    skip: offset,
  });

  // Transform and combine into unified activity format
  const activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string } | null;
  }> = [];

  // Transform activity logs
  for (const log of activityLogs) {
    activities.push({
      id: log.id,
      type: log.type,
      title: log.title,
      description: log.description,
      metadata: log.metadata as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
      user: log.user,
    });
  }

  // Transform message logs into activity format
  for (const msg of messageLogs) {
    // Only add if not already represented by an EMAIL_SENT activity log
    const hasActivityLog = activityLogs.some(
      (a) => a.type === 'EMAIL_SENT' && (a.metadata as Record<string, unknown>)?.messageId === msg.id
    );

    if (!hasActivityLog) {
      // Strip HTML tags for plain text preview
      const textBody = msg.body
        ? msg.body
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace &nbsp;
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
        : null;

      activities.push({
        id: `msg-${msg.id}`,
        type: 'EMAIL_SENT',
        title: msg.subject || 'Email sent',
        description: null,
        metadata: {
          messageId: msg.id,
          to: msg.recipient,
          subject: msg.subject,
          body: textBody,
          htmlBody: msg.body || null,
          status: msg.status,
          openedAt: msg.openedAt?.toISOString() || null,
          clickedAt: msg.clickedAt?.toISOString() || null,
        },
        createdAt: msg.sentAt.toISOString(),
        user: null,
      });
    }
  }

  // Sort combined activities by createdAt (newest first)
  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Apply limit to combined results
  const limitedActivities = activities.slice(0, limit);

  return NextResponse.json({
    activities: limitedActivities,
    hasMore: activities.length > limit,
    total: activities.length,
  });
}
