import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createAgencySchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  feePercentage: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/agencies - List all agencies with stats
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agencies = await prisma.agency.findMany({
      include: {
        recruiters: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        candidates: {
          select: { id: true, status: true },
        },
        jobs: {
          where: { isActive: true },
          select: { jobId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform with stats
    const agenciesWithStats = agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      contactName: agency.contactName,
      contactEmail: agency.contactEmail,
      contactPhone: agency.contactPhone,
      website: agency.website,
      feePercentage: agency.feePercentage ? Number(agency.feePercentage) : null,
      notes: agency.notes,
      isActive: agency.isActive,
      createdAt: agency.createdAt,
      recruiterCount: agency.recruiters.length,
      recruiters: agency.recruiters,
      candidateCount: agency.candidates.length,
      hiredCount: agency.candidates.filter((c) => c.status === 'HIRED').length,
      activeJobCount: agency.jobs.length,
    }));

    return NextResponse.json({ agencies: agenciesWithStats });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agencies' },
      { status: 500 }
    );
  }
}

// POST /api/agencies - Create new agency
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createAgencySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const agency = await prisma.agency.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
        website: parsed.data.website,
        feePercentage: parsed.data.feePercentage,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json({ agency }, { status: 201 });
  } catch (error) {
    console.error('Error creating agency:', error);
    return NextResponse.json(
      { error: 'Failed to create agency' },
      { status: 500 }
    );
  }
}
