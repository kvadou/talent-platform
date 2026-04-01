import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market');
  const where = {
    status: 'PUBLISHED' as const,
    ...(market ? { market: { slug: market } } : {})
  };
  const jobs = await prisma.job.findMany({
    where,
    select: { id: true, title: true, description: true, location: true, market: { select: { slug: true, name: true } } },
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json({ jobs });
}
