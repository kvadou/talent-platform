import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const openings = await prisma.jobOpening.findMany({
    where: { jobId },
    include: {
      hiredApplication: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { openingId: 'asc' },
  });

  return NextResponse.json({ openings });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;
  const data = await req.json();

  // Get the next opening ID for this job
  const lastOpening = await prisma.jobOpening.findFirst({
    where: { jobId },
    orderBy: { openingId: 'desc' },
  });

  const nextOpeningId = lastOpening
    ? String(parseInt(lastOpening.openingId) + 1)
    : '1';

  const opening = await prisma.jobOpening.create({
    data: {
      jobId,
      openingId: nextOpeningId,
      status: data.status || 'OPEN',
      openDate: data.openDate ? new Date(data.openDate) : new Date(),
      targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
    },
    include: {
      hiredApplication: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  return NextResponse.json(opening, { status: 201 });
}
