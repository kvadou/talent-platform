import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateCareerSiteSchema = z.object({
  careerSiteUrl: z.string().optional().nullable(),
  careerSiteLogo: z.string().optional().nullable(),
  careerSitePrimaryColor: z.string().optional().nullable(),
  careerSiteHeadline: z.string().optional().nullable(),
  careerSiteDescription: z.string().optional().nullable(),
});

// GET /api/career-site - Get career site settings
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the first organization (single-tenant for now)
    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        careerSiteUrl: true,
        careerSiteLogo: true,
        careerSitePrimaryColor: true,
        careerSiteHeadline: true,
        careerSiteDescription: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      settings: {
        url: organization.careerSiteUrl || '',
        logo: organization.careerSiteLogo || '',
        primaryColor: organization.careerSitePrimaryColor || '#7C3AED',
        headline: organization.careerSiteHeadline || 'Join Our Team',
        description: organization.careerSiteDescription || '',
      },
      organizationName: organization.name,
    });
  } catch (error) {
    console.error('Error fetching career site settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch career site settings' },
      { status: 500 }
    );
  }
}

// PUT /api/career-site - Update career site settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateCareerSiteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get the first organization
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: parsed.data,
      select: {
        careerSiteUrl: true,
        careerSiteLogo: true,
        careerSitePrimaryColor: true,
        careerSiteHeadline: true,
        careerSiteDescription: true,
      },
    });

    return NextResponse.json({
      settings: {
        url: updated.careerSiteUrl || '',
        logo: updated.careerSiteLogo || '',
        primaryColor: updated.careerSitePrimaryColor || '#7C3AED',
        headline: updated.careerSiteHeadline || 'Join Our Team',
        description: updated.careerSiteDescription || '',
      },
    });
  } catch (error) {
    console.error('Error updating career site settings:', error);
    return NextResponse.json(
      { error: 'Failed to update career site settings' },
      { status: 500 }
    );
  }
}
