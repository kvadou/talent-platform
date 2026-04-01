import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createRecruiterSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
});

// GET /api/agencies/[id]/recruiters - List recruiters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId } = await params;

    const recruiters = await prisma.agencyRecruiter.findMany({
      where: { agencyId },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return NextResponse.json({
      recruiters: recruiters.map((r) => ({
        ...r,
        candidateCount: r._count.candidates,
      })),
    });
  } catch (error) {
    console.error('Error fetching recruiters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recruiters' },
      { status: 500 }
    );
  }
}

// POST /api/agencies/[id]/recruiters - Add recruiter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId } = await params;
    const body = await request.json();
    const parsed = createRecruiterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const recruiter = await prisma.agencyRecruiter.create({
      data: {
        agencyId,
        ...parsed.data,
      },
    });

    return NextResponse.json({ recruiter }, { status: 201 });
  } catch (error) {
    console.error('Error creating recruiter:', error);
    return NextResponse.json(
      { error: 'Failed to create recruiter' },
      { status: 500 }
    );
  }
}

// DELETE /api/agencies/[id]/recruiters - Delete recruiter (by recruiterId in body)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recruiterId } = await request.json();

    if (!recruiterId) {
      return NextResponse.json(
        { error: 'Recruiter ID required' },
        { status: 400 }
      );
    }

    await prisma.agencyRecruiter.delete({
      where: { id: recruiterId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recruiter:', error);
    return NextResponse.json(
      { error: 'Failed to delete recruiter' },
      { status: 500 }
    );
  }
}
