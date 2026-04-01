import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  if (!query.trim() || query.trim().length < 2) {
    return NextResponse.json({ candidates: [], jobs: [], applications: [] });
  }

  const searchTerm = query.trim();

  // Search candidates
  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ],
      // Scope by market access through applications
      ...(access.marketIds ? {
        applications: {
          some: {
            job: { marketId: { in: access.marketIds } },
          },
        },
      } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });

  // Search jobs
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
        { requisitionId: { contains: searchTerm, mode: 'insensitive' } },
      ],
      ...(access.marketIds ? { marketId: { in: access.marketIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      market: { select: { name: true } },
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });

  // Search applications (by candidate name or job title)
  const applications = await prisma.application.findMany({
    where: {
      OR: [
        { candidate: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { candidate: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { job: { title: { contains: searchTerm, mode: 'insensitive' } } },
      ],
      ...(access.marketIds ? { job: { marketId: { in: access.marketIds } } } : {}),
    },
    select: {
      id: true,
      status: true,
      candidate: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      job: {
        select: {
          title: true,
        },
      },
      stage: {
        select: {
          name: true,
        },
      },
    },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    candidates,
    jobs,
    applications,
  });
}
