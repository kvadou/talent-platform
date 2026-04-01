import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Get the first organization's career site settings
  const org = await prisma.organization.findFirst({
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
      url: org?.careerSiteUrl || '',
      logo: org?.careerSiteLogo || '',
      primaryColor: org?.careerSitePrimaryColor || '#7C3AED',
      headline: org?.careerSiteHeadline || 'Join Our Team',
      description: org?.careerSiteDescription || '',
    },
  });
}
