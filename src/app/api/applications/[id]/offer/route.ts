import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ActivityLogger } from '@/lib/activity-logger';

const createOfferSchema = z.object({
  compensationType: z.enum(['HOURLY', 'SALARY', 'CONTRACT']),
  hourlyRate: z.number().nullable().optional(),
  salary: z.number().nullable().optional(),
  signOnBonus: z.number().nullable().optional(),
  startDate: z.string(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP']),
  notes: z.string().nullable().optional(),
});

const updateOfferSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN']).optional(),
  declineReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;

    const offer = await prisma.offer.findUnique({
      where: { applicationId },
      include: {
        application: {
          select: {
            candidate: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            job: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ offer: null });
    }

    return NextResponse.json({
      offer: {
        id: offer.id,
        compensationType: offer.compensationType,
        hourlyRate: offer.hourlyRate ? Number(offer.hourlyRate) : null,
        salary: offer.salary ? Number(offer.salary) : null,
        signOnBonus: offer.signOnBonus ? Number(offer.signOnBonus) : null,
        currency: offer.currency,
        employmentType: offer.employmentType,
        startDate: offer.startDate?.toISOString() || null,
        status: offer.status,
        version: offer.version,
        letterUrl: offer.letterUrl,
        signedUrl: offer.signedUrl,
        declineReason: offer.declineReason,
        acceptedAt: offer.acceptedAt?.toISOString() || null,
        declinedAt: offer.declinedAt?.toISOString() || null,
        createdAt: offer.createdAt.toISOString(),
        updatedAt: offer.updatedAt.toISOString(),
        candidate: offer.application.candidate,
        job: offer.application.job,
      },
    });
  } catch (error) {
    console.error('Failed to fetch offer:', error);
    return NextResponse.json({ error: 'Failed to fetch offer' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;

    // Get user and application
    const [user, application] = await Promise.all([
      prisma.user.findUnique({ where: { email: session.user.email } }),
      prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true } },
          job: { select: { id: true, title: true } },
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Check if offer already exists
    const existingOffer = await prisma.offer.findUnique({
      where: { applicationId },
    });

    if (existingOffer) {
      return NextResponse.json({ error: 'Offer already exists for this application' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createOfferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { compensationType, hourlyRate, salary, signOnBonus, startDate, employmentType, notes } = parsed.data;

    const offer = await prisma.offer.create({
      data: {
        applicationId,
        jobId: application.job.id,
        compensationType,
        hourlyRate: hourlyRate ?? undefined,
        salary: salary ?? undefined,
        signOnBonus: signOnBonus ?? undefined,
        startDate: new Date(startDate),
        employmentType,
        benefits: notes,
        status: 'DRAFT',
        createdBy: user.id,
      },
    });

    // Log activity
    const compensation = isHourly(compensationType)
      ? `$${hourlyRate}/hr`
      : `$${salary?.toLocaleString()}`;
    await ActivityLogger.offerCreated({
      applicationId,
      userId: user.id,
      candidateName: `${application.candidate.firstName} ${application.candidate.lastName}`,
      compensation,
    });

    function isHourly(type: string) {
      return type === 'HOURLY';
    }

    return NextResponse.json({
      offer: {
        id: offer.id,
        compensationType: offer.compensationType,
        hourlyRate: offer.hourlyRate ? Number(offer.hourlyRate) : null,
        salary: offer.salary ? Number(offer.salary) : null,
        signOnBonus: offer.signOnBonus ? Number(offer.signOnBonus) : null,
        currency: offer.currency,
        employmentType: offer.employmentType,
        startDate: offer.startDate?.toISOString() || null,
        status: offer.status,
        createdAt: offer.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create offer:', error);
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;

    const body = await request.json();
    const parsed = updateOfferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { status, declineReason } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'ACCEPTED') {
        updateData.acceptedAt = new Date();
      } else if (status === 'DECLINED') {
        updateData.declinedAt = new Date();
        if (declineReason) {
          updateData.declineReason = declineReason;
        }
      }
    }

    const offer = await prisma.offer.update({
      where: { applicationId },
      data: updateData,
    });

    return NextResponse.json({
      offer: {
        id: offer.id,
        status: offer.status,
        acceptedAt: offer.acceptedAt?.toISOString() || null,
        declinedAt: offer.declinedAt?.toISOString() || null,
        declineReason: offer.declineReason,
      },
    });
  } catch (error) {
    console.error('Failed to update offer:', error);
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 });
  }
}
