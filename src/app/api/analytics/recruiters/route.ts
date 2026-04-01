import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '30d';

  const now = new Date();
  let startDate: Date | null = null;
  if (range === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (range === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  else if (range === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const marketWhere = access.marketIds ? { marketId: { in: access.marketIds } } : {};

  // Get all users who are on hiring teams (active recruiters)
  const hiringTeamMembers = await prisma.jobHiringTeam.findMany({
    where: { job: { ...marketWhere } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });

  // Dedup users
  const userMap = new Map<string, typeof hiringTeamMembers[0]['user']>();
  for (const ht of hiringTeamMembers) {
    if (!userMap.has(ht.userId)) userMap.set(ht.userId, ht.user);
  }
  const users = Array.from(userMap.values());

  // For each user, get stats
  const dateFilter = startDate ? { gte: startDate } : undefined;

  const recruiterStats = await Promise.all(
    users.map(async (user) => {
      const [
        interviewsConducted,
        feedbackSubmitted,
        stageMovesInitiated,
        emailsSent,
        tasksCompleted,
      ] = await Promise.all([
        // Interviews conducted by this user
        prisma.interview.count({
          where: {
            interviewerId: user.id,
            ...(startDate ? { scheduledAt: { gte: startDate, lte: now } } : {}),
            application: { job: marketWhere },
          },
        }),
        // Feedback submitted
        prisma.interviewFeedback.count({
          where: {
            userId: user.id,
            ...(startDate ? { createdAt: dateFilter } : {}),
          },
        }),
        // Stage moves initiated (via activity log)
        prisma.activityLog.count({
          where: {
            userId: user.id,
            type: 'STAGE_CHANGE',
            ...(startDate ? { createdAt: dateFilter } : {}),
          },
        }),
        // Emails sent
        prisma.activityLog.count({
          where: {
            userId: user.id,
            type: 'EMAIL_SENT',
            ...(startDate ? { createdAt: dateFilter } : {}),
          },
        }),
        // Tasks completed
        prisma.task.count({
          where: {
            assigneeId: user.id,
            status: 'COMPLETED',
            ...(startDate ? { updatedAt: dateFilter } : {}),
          },
        }),
      ]);

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        interviews: interviewsConducted,
        feedback: feedbackSubmitted,
        stageMoves: stageMovesInitiated,
        emails: emailsSent,
        tasksCompleted,
        totalActions: interviewsConducted + feedbackSubmitted + stageMovesInitiated + emailsSent + tasksCompleted,
      };
    })
  );

  // Sort by total actions descending
  recruiterStats.sort((a, b) => b.totalActions - a.totalActions);

  return NextResponse.json({ recruiters: recruiterStats });
}
