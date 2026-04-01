import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { canAccessApplication, requireAnyRole, requireApiUser } from '@/lib/api-auth';

// Schema for creating/updating hiring outcome
const outcomeSchema = z.object({
  wasHired: z.boolean(),
  hireDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  stillEmployedAt30Days: z.boolean().optional().nullable(),
  stillEmployedAt90Days: z.boolean().optional().nullable(),
  stillEmployedAt180Days: z.boolean().optional().nullable(),
  terminatedAt: z.string().datetime().optional().nullable(),
  terminationReason: z.string().optional().nullable(),
  performanceRating: z.number().min(1).max(5).optional().nullable(),
  performanceNotes: z.string().optional().nullable(),
  rejectionRegret: z.boolean().optional(),
  regretNotes: z.string().optional().nullable(),
});

// GET - Retrieve outcome for an application
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const outcome = await prisma.hiringOutcome.findUnique({
    where: { applicationId: id },
    include: {
      application: {
        include: {
          candidate: {
            select: { firstName: true, lastName: true, email: true }
          },
          job: {
            select: { title: true }
          }
        }
      }
    }
  });

  if (!outcome) {
    // Return empty but with application info if it exists
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        candidate: {
          select: { firstName: true, lastName: true, email: true }
        },
        job: {
          select: { title: true }
        }
      }
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ outcome: null, application });
  }

  return NextResponse.json({ outcome });
}

// POST - Create or update outcome
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;
  const { id } = await params;
  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify application exists
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: { select: { firstName: true, lastName: true } }
    }
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const body = await request.json();
  const parsed = outcomeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Convert string dates to Date objects
  const outcomeData = {
    wasHired: data.wasHired,
    hireDate: data.hireDate ? new Date(data.hireDate) : null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    stillEmployedAt30Days: data.stillEmployedAt30Days,
    stillEmployedAt90Days: data.stillEmployedAt90Days,
    stillEmployedAt180Days: data.stillEmployedAt180Days,
    terminatedAt: data.terminatedAt ? new Date(data.terminatedAt) : null,
    terminationReason: data.terminationReason,
    performanceRating: data.performanceRating,
    performanceNotes: data.performanceNotes,
    rejectionRegret: data.rejectionRegret ?? false,
    regretNotes: data.regretNotes,
  };

  // Upsert the outcome
  const outcome = await prisma.hiringOutcome.upsert({
    where: { applicationId: id },
    create: {
      applicationId: id,
      ...outcomeData,
    },
    update: outcomeData,
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      applicationId: id,
      type: 'STATUS_CHANGE',
      title: data.wasHired ? 'Hiring outcome recorded' : 'Rejection outcome recorded',
      description: data.wasHired
        ? `${application.candidate.firstName} ${application.candidate.lastName} was hired`
        : `${application.candidate.firstName} ${application.candidate.lastName} was not hired`,
      metadata: {
        wasHired: data.wasHired,
        hireDate: data.hireDate,
        startDate: data.startDate,
      },
    },
  });

  return NextResponse.json({ outcome });
}

// PATCH - Update specific fields (for retention tracking, performance updates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;
  const { id } = await params;
  if (!(await canAccessApplication(auth.email, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify outcome exists
  const existing = await prisma.hiringOutcome.findUnique({
    where: { applicationId: id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Outcome not found. Create one first with POST.' },
      { status: 404 }
    );
  }

  const body = await request.json();

  // Allow partial updates
  const updateData: Record<string, unknown> = {};

  // Retention checkpoints
  if (body.stillEmployedAt30Days !== undefined) {
    updateData.stillEmployedAt30Days = body.stillEmployedAt30Days;
  }
  if (body.stillEmployedAt90Days !== undefined) {
    updateData.stillEmployedAt90Days = body.stillEmployedAt90Days;
  }
  if (body.stillEmployedAt180Days !== undefined) {
    updateData.stillEmployedAt180Days = body.stillEmployedAt180Days;
  }

  // Termination
  if (body.terminatedAt !== undefined) {
    updateData.terminatedAt = body.terminatedAt ? new Date(body.terminatedAt) : null;
  }
  if (body.terminationReason !== undefined) {
    updateData.terminationReason = body.terminationReason;
  }

  // Performance
  if (body.performanceRating !== undefined) {
    updateData.performanceRating = body.performanceRating;
  }
  if (body.performanceNotes !== undefined) {
    updateData.performanceNotes = body.performanceNotes;
  }

  // Rejection regret
  if (body.rejectionRegret !== undefined) {
    updateData.rejectionRegret = body.rejectionRegret;
  }
  if (body.regretNotes !== undefined) {
    updateData.regretNotes = body.regretNotes;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const outcome = await prisma.hiringOutcome.update({
    where: { applicationId: id },
    data: updateData,
  });

  return NextResponse.json({ outcome });
}
