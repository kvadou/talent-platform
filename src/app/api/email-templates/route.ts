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
  const scope = searchParams.get('scope');
  const type = searchParams.get('type');
  const jobId = searchParams.get('jobId');
  const stageId = searchParams.get('stageId');

  const templates = await prisma.emailTemplate.findMany({
    where: {
      ...(scope ? { scope: scope as 'GLOBAL' | 'JOB' | 'STAGE' } : {}),
      ...(type ? { type: type as any } : {}),
      ...(jobId ? { jobId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(access.marketIds ? {
        OR: [
          { scope: 'GLOBAL' },
          { job: { marketId: { in: access.marketIds } } }
        ]
      } : {})
    },
    include: {
      job: { select: { id: true, title: true } },
      stage: { select: { id: true, name: true } }
    },
    orderBy: [
      { type: 'asc' },
      { isDefault: 'desc' },
      { name: 'asc' }
    ]
  });

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);

  const body = await req.json();
  const {
    name,
    type,
    description,
    subject,
    body: templateBody,
    scope,
    jobId,
    stageId,
    isDefault,
    mergeFields
  } = body;

  if (!name || !subject || !templateBody) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (jobId && access.marketIds) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { marketId: true }
    });
    if (!job || !access.marketIds.includes(job.marketId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // If setting as default, unset other defaults of same type
  if (isDefault && type) {
    await prisma.emailTemplate.updateMany({
      where: {
        type: type,
        isDefault: true
      },
      data: { isDefault: false }
    });
  }

  const template = await prisma.emailTemplate.create({
    data: {
      name,
      type: type || 'CUSTOM',
      description: description || null,
      subject,
      body: templateBody,
      scope: scope || 'GLOBAL',
      jobId: jobId || null,
      stageId: stageId || null,
      isDefault: Boolean(isDefault),
      mergeFields: mergeFields || null
    }
  });

  return NextResponse.json({ template }, { status: 201 });
}
