import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getUserOrganization } from '@/lib/market-scope';
import { InterviewType } from '@prisma/client';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: jobId } = await params;

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  // Get job-specific scorecards
  const jobScorecards = await prisma.interviewScorecard.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
  });

  // Get organization-level scorecards (not job-specific)
  const orgScorecards = await prisma.interviewScorecard.findMany({
    where: {
      organizationId: org.id,
      jobId: null,
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ jobScorecards, orgScorecards });
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
  const { name, description, type, criteria } = await req.json();

  if (!name || !type || !criteria) {
    return NextResponse.json(
      { error: 'Name, type, and criteria are required' },
      { status: 400 }
    );
  }

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const scorecard = await prisma.interviewScorecard.create({
    data: {
      name,
      description: description || null,
      type: type as InterviewType,
      criteria,
      jobId,
      organizationId: org.id,
      isDefault: false,
    },
  });

  return NextResponse.json(scorecard, { status: 201 });
}
