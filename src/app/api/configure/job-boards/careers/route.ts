import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiUser, requireAnyRole } from '@/lib/api-auth';
import { getUserMarkets } from '@/lib/market-scope';

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN']);
  if (forbidden) return forbidden;

  const access = await getUserMarkets(auth.email);
  const where: any = {};
  if (access.marketIds && access.marketIds.length > 0) {
    where.marketId = { in: access.marketIds };
  }

  const statusOrder: Record<string, number> = {
    PUBLISHED: 0,
    DRAFT: 1,
    CLOSED: 2,
    ARCHIVED: 3,
  };

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      location: true,
      employmentType: true,
      createdAt: true,
      updatedAt: true,
      market: {
        select: {
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
    orderBy: { title: 'asc' },
  });

  jobs.sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return a.title.localeCompare(b.title);
  });

  return NextResponse.json({ jobs });
}
