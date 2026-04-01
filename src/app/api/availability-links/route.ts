import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, ensureUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

// GET - List availability links with filters
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureUser();

  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  const status = searchParams.get('status');

  const links = await prisma.availabilityLink.findMany({
    where: {
      ...(applicationId ? { applicationId } : {}),
      ...(status ? { status: status as any } : {})
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true } }
        }
      },
      stage: { select: { name: true } },
      availabilities: {
        orderBy: { startTime: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ links });
}

// POST - Create a new availability link
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await req.json();
  const {
    applicationId,
    stageId,
    interviewerIds,
    duration = 60,
    instructions,
    dateRangeStart,
    dateRangeEnd,
    expiresInDays = 7
  } = body;

  if (!applicationId || !stageId) {
    return NextResponse.json({ error: 'applicationId and stageId are required' }, { status: 400 });
  }

  // Verify application exists
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { candidate: true, job: true }
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Generate unique token
  const token = randomBytes(24).toString('hex');

  const link = await prisma.availabilityLink.create({
    data: {
      applicationId,
      stageId,
      token,
      interviewerIds: interviewerIds || [dbUser.id],
      duration,
      instructions,
      dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : null,
      dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : null,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true } }
        }
      },
      stage: { select: { name: true } }
    }
  });

  // Generate the full URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const availabilityUrl = `${baseUrl}/availability/${token}`;

  return NextResponse.json({
    link,
    url: availabilityUrl
  }, { status: 201 });
}
