import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const type = searchParams.get('type');

  const where: any = {
    organizationId: user.organizationId
  };

  if (jobId) where.jobId = jobId;
  if (type) where.type = type;

  const scorecards = await prisma.interviewScorecard.findMany({
    where,
    include: {
      job: {
        select: {
          id: true,
          title: true
        }
      },
      _count: {
        select: {
          interviews: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ scorecards });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { name, description, type, criteria, jobId, isDefault } = body;

  if (!name || !type || !criteria || !Array.isArray(criteria)) {
    return NextResponse.json({
      error: 'Missing required fields: name, type, and criteria are required'
    }, { status: 400 });
  }

  // Validate criteria format
  for (const criterion of criteria) {
    if (!criterion.id || !criterion.name || !criterion.scoringType) {
      return NextResponse.json({
        error: 'Invalid criteria format. Each criterion must have id, name, and scoringType'
      }, { status: 400 });
    }
    if (!['SCALE', 'BOOLEAN', 'TEXT'].includes(criterion.scoringType)) {
      return NextResponse.json({
        error: 'Invalid scoringType. Must be SCALE, BOOLEAN, or TEXT'
      }, { status: 400 });
    }
  }

  const scorecard = await prisma.interviewScorecard.create({
    data: {
      name,
      description: description || null,
      type,
      criteria,
      jobId: jobId || null,
      organizationId: user.organizationId,
      isDefault: isDefault || false
    },
    include: {
      job: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  return NextResponse.json({ scorecard });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { id, name, description, type, criteria, jobId, isDefault } = body;

  if (!id) {
    return NextResponse.json({ error: 'Scorecard ID is required' }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.interviewScorecard.findFirst({
    where: { id, organizationId: user.organizationId }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (type) updateData.type = type;
  if (criteria) updateData.criteria = criteria;
  if (jobId !== undefined) updateData.jobId = jobId;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const scorecard = await prisma.interviewScorecard.update({
    where: { id },
    data: updateData,
    include: {
      job: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  return NextResponse.json({ scorecard });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await ensureUser();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Scorecard ID is required' }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.interviewScorecard.findFirst({
    where: { id, organizationId: user.organizationId }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
  }

  await prisma.interviewScorecard.delete({
    where: { id }
  });

  return NextResponse.json({ success: true });
}
