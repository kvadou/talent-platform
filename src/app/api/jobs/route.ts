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
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status');
  const marketIdFilter = searchParams.get('marketId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const skip = (page - 1) * limit;

  // Calculate date 7 days ago for "new" applications
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Build where clause
  const where: any = {};

  // Market access restriction
  if (access.marketIds) {
    where.marketId = { in: access.marketIds };
  }

  // Status filter
  if (status) {
    where.status = status;
  }

  // Market filter
  if (marketIdFilter) {
    where.marketId = marketIdFilter;
  }

  // Search filter
  if (search.trim()) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
      { market: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Get total count for pagination
  const total = await prisma.job.count({ where });

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      market: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      location: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          applications: true,
        },
      },
      stages: {
        select: { id: true, name: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
    skip,
    take: limit,
  });

  const recentByJob = await prisma.application.groupBy({
    by: ['jobId'],
    where: {
      jobId: { in: jobs.map((j) => j.id) },
      createdAt: { gte: sevenDaysAgo },
    },
    _count: { id: true },
  });
  const recentByJobMap = new Map(recentByJob.map((row) => [row.jobId, row._count.id]));

  // Transform to include calculated fields
  const jobsWithCounts = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    market: job.market,
    department: job.department,
    location: job.location,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    candidateCount: job._count.applications,
    newCount: recentByJobMap.get(job.id) ?? 0,
    daysOpen: Math.floor((Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    stages: job.stages,
  }));

  // Get all markets for filter dropdown
  const markets = await prisma.market.findMany({
    where: access.marketIds ? { id: { in: access.marketIds } } : {},
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    jobs: jobsWithCounts,
    markets,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  // Support both FormData (legacy) and JSON
  const contentType = req.headers.get('content-type') || '';
  let data: Record<string, any>;

  if (contentType.includes('application/json')) {
    data = await req.json();
  } else {
    const form = await req.formData();
    data = {
      title: form.get('title')?.toString(),
      description: form.get('description')?.toString(),
      location: form.get('location')?.toString(),
      marketId: form.get('marketId')?.toString(),
      status: form.get('status')?.toString() ?? 'DRAFT',
    };
  }

  const {
    title,
    description,
    location,
    marketId,
    status = 'DRAFT',
    departmentId,
    officeId,
    employmentType = 'FULL_TIME',
    internalJobName,
    requisitionId,
    openDate,
  } = data;

  if (!title || !marketId) {
    return NextResponse.json({ error: 'Title and Market are required' }, { status: 400 });
  }

  if (access.marketIds && !access.marketIds.includes(marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate requisition ID if not provided
  let finalRequisitionId = requisitionId;
  if (!finalRequisitionId) {
    const jobCount = await prisma.job.count();
    finalRequisitionId = `REQ-${String(jobCount + 1).padStart(4, '0')}`;
  }

  const job = await prisma.job.create({
    data: {
      title,
      description: description || null,
      location: location || null,
      marketId,
      status: status as any,
      departmentId: departmentId || null,
      officeId: officeId || null,
      employmentType: employmentType as any,
      internalJobName: internalJobName || null,
      requisitionId: finalRequisitionId,
      openDate: openDate ? new Date(openDate) : new Date(),
    },
    include: {
      market: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      office: { select: { id: true, name: true } },
    },
  });

  // Create default stages if none exist
  const hasDefaultStage = await prisma.stage.findFirst({ where: { jobId: job.id } });
  if (!hasDefaultStage) {
    await prisma.stage.createMany({
      data: [
        { jobId: job.id, name: 'Applied', order: 1, isDefault: true },
        { jobId: job.id, name: 'Phone Screen', order: 2, isDefault: false },
        { jobId: job.id, name: 'Interview', order: 3, isDefault: false },
        { jobId: job.id, name: 'Offer', order: 4, isDefault: false },
      ],
    });
  }

  return NextResponse.json(job);
}
