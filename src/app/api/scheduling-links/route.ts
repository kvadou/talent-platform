import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { getUserMarkets } from '@/lib/market-scope';
import { hashToken, generateToken } from '@/lib/tokens';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  const stageId = searchParams.get('stageId');
  
  const links = await prisma.schedulingLink.findMany({
    where: {
      ...(applicationId ? { applicationId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(access.marketIds ? {
        application: {
          job: {
            marketId: { in: access.marketIds }
          }
        }
      } : {})
    },
    include: {
      application: {
        select: {
          id: true,
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } }
        }
      },
      stage: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ links });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureUser();
  const access = await getUserMarkets(session.user.email);
  
  const body = await req.json();
  const {
    applicationId,
    stageId,
    interviewerIds,
    duration,
    bufferBefore,
    bufferAfter,
    minNoticeHours,
    maxDaysOut,
    timezone,
    expiresAt
  } = body;
  
  if (!applicationId || !stageId || !interviewerIds || !Array.isArray(interviewerIds) || interviewerIds.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Verify market access
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { marketId: true } } }
  });
  
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  
  if (access.marketIds && !access.marketIds.includes(application.job.marketId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Generate unique token — store hash, return raw token to caller
  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);

  const link = await prisma.schedulingLink.create({
    data: {
      applicationId,
      stageId,
      token: hashedToken,
      interviewerIds,
      duration: duration || 30,
      bufferBefore: bufferBefore || 15,
      bufferAfter: bufferAfter || 15,
      minNoticeHours: minNoticeHours || 24,
      maxDaysOut: maxDaysOut || 30,
      timezone: timezone || 'America/Chicago',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: 'ACTIVE'
    }
  });
  
  return NextResponse.json({ link, token: rawToken });
}

