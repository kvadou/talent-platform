import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { InterviewType } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string; scorecardId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, scorecardId } = await params;

  const scorecard = await prisma.interviewScorecard.findFirst({
    where: { id: scorecardId, jobId },
  });

  if (!scorecard) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  return NextResponse.json(scorecard);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, scorecardId } = await params;
  const { name, description, type, criteria } = await req.json();

  const scorecard = await prisma.interviewScorecard.findFirst({
    where: { id: scorecardId, jobId },
  });

  if (!scorecard) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  const updated = await prisma.interviewScorecard.update({
    where: { id: scorecardId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(type && { type: type as InterviewType }),
      ...(criteria && { criteria }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId, scorecardId } = await params;

  const scorecard = await prisma.interviewScorecard.findFirst({
    where: { id: scorecardId, jobId },
  });

  if (!scorecard) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  // Check if any interviews use this scorecard
  const usageCount = await prisma.interview.count({
    where: { scorecardId },
  });

  if (usageCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${usageCount} interviews use this scorecard` },
      { status: 400 }
    );
  }

  await prisma.interviewScorecard.delete({
    where: { id: scorecardId },
  });

  return NextResponse.json({ success: true });
}
