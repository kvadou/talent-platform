import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  content: z.string().min(1),
  mergeTokens: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

// Available merge tokens for offer templates
const AVAILABLE_MERGE_TOKENS = [
  '{{CANDIDATE_NAME}}',
  '{{CANDIDATE_FIRST_NAME}}',
  '{{CANDIDATE_LAST_NAME}}',
  '{{CANDIDATE_EMAIL}}',
  '{{JOB_TITLE}}',
  '{{DEPARTMENT}}',
  '{{OFFICE_LOCATION}}',
  '{{START_DATE}}',
  '{{SALARY}}',
  '{{HOURLY_RATE}}',
  '{{SIGN_ON_BONUS}}',
  '{{COMPENSATION_TYPE}}',
  '{{HIRING_MANAGER}}',
  '{{COMPANY_NAME}}',
  '{{OFFER_EXPIRATION_DATE}}',
  '{{TODAY_DATE}}',
];

// GET /api/offer-templates - List all templates
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.offerTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      templates,
      availableMergeTokens: AVAILABLE_MERGE_TOKENS,
    });
  } catch (error) {
    console.error('Error fetching offer templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer templates' },
      { status: 500 }
    );
  }
}

// POST /api/offer-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Extract used merge tokens from content
    const usedTokens = AVAILABLE_MERGE_TOKENS.filter((token) =>
      parsed.data.content.includes(token)
    );

    // If setting as default, unset other defaults
    if (parsed.data.isDefault) {
      await prisma.offerTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.offerTemplate.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        content: parsed.data.content,
        mergeTokens: usedTokens,
        isDefault: parsed.data.isDefault || false,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating offer template:', error);
    return NextResponse.json(
      { error: 'Failed to create offer template' },
      { status: 500 }
    );
  }
}
