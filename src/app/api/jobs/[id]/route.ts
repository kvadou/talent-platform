import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessJob, requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!(await canAccessJob(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      market: true,
      department: true,
      office: true,
      stages: { orderBy: { order: 'asc' } },
      autoAdvanceToStage: { select: { id: true, name: true } },
      openings: {
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
      },
      hiringTeam: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      notificationConfigs: true,
      posts: true,
      forms: {
        include: {
          stage: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          applications: true,
          openings: true,
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { id } = await params;
  if (!(await canAccessJob(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = await req.json();

  // Clean up empty strings to null
  const cleanData = {
    title: data.title || undefined,
    internalJobName: data.internalJobName || null,
    description: data.description || null,
    location: data.location || null,
    requisitionId: data.requisitionId || null,
    status: data.status || undefined,
    employmentType: data.employmentType || undefined,
    departmentId: data.departmentId || null,
    officeId: data.officeId || null,
    esignTemplateId: data.esignTemplateId || null,
  };

  const job = await prisma.job.update({
    where: { id },
    data: cleanData,
    include: {
      market: true,
      department: true,
      office: true,
      openings: {
        include: {
          hiredApplication: {
            include: {
              candidate: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(job);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { id } = await params;
  if (!(await canAccessJob(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = await req.json();

  const job = await prisma.job.update({
    where: { id },
    data,
  });

  return NextResponse.json({ job });
}
