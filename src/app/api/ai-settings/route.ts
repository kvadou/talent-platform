import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateAISettingsSchema = z.object({
  aiEmailEditor: z.boolean().optional(),
  aiInterviewQuestions: z.boolean().optional(),
  aiJobNoteSummaries: z.boolean().optional(),
  aiJobDescriptions: z.boolean().optional(),
  aiKeywordSuggestions: z.boolean().optional(),
  aiOfferForecast: z.boolean().optional(),
  aiReportBuilder: z.boolean().optional(),
  aiScorecardSuggestions: z.boolean().optional(),
});

// GET /api/ai-settings - Get AI settings
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        aiEmailEditor: true,
        aiInterviewQuestions: true,
        aiJobNoteSummaries: true,
        aiJobDescriptions: true,
        aiKeywordSuggestions: true,
        aiOfferForecast: true,
        aiReportBuilder: true,
        aiScorecardSuggestions: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ settings: organization });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI settings' },
      { status: 500 }
    );
  }
}

// PUT /api/ai-settings - Update AI settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateAISettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findFirst();

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: parsed.data,
      select: {
        id: true,
        aiEmailEditor: true,
        aiInterviewQuestions: true,
        aiJobNoteSummaries: true,
        aiJobDescriptions: true,
        aiKeywordSuggestions: true,
        aiOfferForecast: true,
        aiReportBuilder: true,
        aiScorecardSuggestions: true,
      },
    });

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    );
  }
}
