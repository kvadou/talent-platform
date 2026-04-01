import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  content: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/offer-templates/[id] - Get template details
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

    const template = await prisma.offerTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/offer-templates/[id] - Update template
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
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (parsed.data.isDefault) {
      await prisma.offerTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Extract used merge tokens if content is being updated
    let updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.content) {
      const usedTokens = AVAILABLE_MERGE_TOKENS.filter((token) =>
        parsed.data.content!.includes(token)
      );
      updateData.mergeTokens = usedTokens;
    }

    const template = await prisma.offerTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/offer-templates/[id] - Delete template
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

    await prisma.offerTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
