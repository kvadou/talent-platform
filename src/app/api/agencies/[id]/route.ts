import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateAgencySchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  feePercentage: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/agencies/[id] - Get agency details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const agency = await prisma.agency.findUnique({
      where: { id },
      include: {
        recruiters: {
          orderBy: { lastName: 'asc' },
        },
        candidates: {
          include: {
            recruiter: {
              select: { firstName: true, lastName: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
        jobs: {
          where: { isActive: true },
        },
      },
    });

    if (!agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    return NextResponse.json({
      agency: {
        ...agency,
        feePercentage: agency.feePercentage ? Number(agency.feePercentage) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching agency:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agency' },
      { status: 500 }
    );
  }
}

// PUT /api/agencies/[id] - Update agency
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAgencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const agency = await prisma.agency.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      agency: {
        ...agency,
        feePercentage: agency.feePercentage ? Number(agency.feePercentage) : null,
      },
    });
  } catch (error) {
    console.error('Error updating agency:', error);
    return NextResponse.json(
      { error: 'Failed to update agency' },
      { status: 500 }
    );
  }
}

// DELETE /api/agencies/[id] - Delete agency
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.agency.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agency:', error);
    return NextResponse.json(
      { error: 'Failed to delete agency' },
      { status: 500 }
    );
  }
}
