import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { candidateId, jobId, stageId, source } = body;

    if (!candidateId || !jobId || !stageId) {
      return NextResponse.json(
        { error: 'candidateId, jobId, and stageId are required' },
        { status: 400 }
      );
    }

    // Check if application already exists for this candidate and job
    const existingApplication = await prisma.application.findFirst({
      where: { candidateId, jobId },
    });

    if (existingApplication) {
      return NextResponse.json(
        { error: 'Application already exists for this candidate and job' },
        { status: 409 }
      );
    }

    // Create application with initial stage history
    const application = await prisma.application.create({
      data: {
        candidateId,
        jobId,
        stageId,
        source: source || 'MANUAL',
        status: 'ACTIVE',
        stageHistory: {
          create: {
            stageId,
            movedBy: session.user.email,
          },
        },
      },
      include: {
        candidate: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: { id: true, title: true },
        },
        stage: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Application already exists for this candidate and job' },
        { status: 409 }
      );
    }
    console.error('Failed to create application:', error);
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const stageId = searchParams.get('stageId');
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    ...(access.marketIds ? { job: { marketId: { in: access.marketIds } } } : {}),
    ...(jobId ? { jobId } : {}),
    ...(stageId ? { stageId } : {}),
    ...(status ? { status: status as any } : {}),
  };

  // Add search filter
  if (search.trim()) {
    where.OR = [
      { candidate: { firstName: { contains: search, mode: 'insensitive' } } },
      { candidate: { lastName: { contains: search, mode: 'insensitive' } } },
      { candidate: { email: { contains: search, mode: 'insensitive' } } },
      { job: { title: { contains: search, mode: 'insensitive' } } },
      { stage: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Get total count for pagination
  const total = await prisma.application.count({ where });

  const applications = await prisma.application.findMany({
    where,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          resumeUrl: true
        }
      },
      job: {
        select: {
          id: true,
          title: true,
          market: { select: { name: true } }
        }
      },
      stage: {
        select: {
          id: true,
          name: true,
          order: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}
