import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; openingId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { openingId } = await params;

  const opening = await prisma.jobOpening.findUnique({
    where: { id: openingId },
    include: {
      hiredApplication: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!opening) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(opening);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; openingId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { openingId } = await params;
  const data = await req.json();

  const opening = await prisma.jobOpening.update({
    where: { id: openingId },
    data: {
      status: data.status,
      targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      closeReason: data.closeReason || null,
      hiredApplicationId: data.hiredApplicationId || null,
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

  return NextResponse.json(opening);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; openingId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { openingId } = await params;

  await prisma.jobOpening.delete({
    where: { id: openingId },
  });

  return NextResponse.json({ success: true });
}
