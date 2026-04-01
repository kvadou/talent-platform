import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  steps: z
    .array(
      z.object({
        id: z.string().optional(), // Existing step ID
        name: z.string().min(1),
        approverIds: z.array(z.string()),
        isRequired: z.boolean().default(true),
      })
    )
    .optional(),
});

// GET /api/approvals/[id] - Get workflow details
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

    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    );
  }
}

// PUT /api/approvals/[id] - Update workflow
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
    const parsed = updateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // If steps are provided, we need to handle them specially
    if (parsed.data.steps) {
      // Delete all existing steps and recreate
      await prisma.approvalWorkflowStep.deleteMany({
        where: { workflowId: id },
      });

      // Create new steps
      await prisma.approvalWorkflowStep.createMany({
        data: parsed.data.steps.map((step, index) => ({
          workflowId: id,
          order: index + 1,
          name: step.name,
          approverIds: step.approverIds,
          isRequired: step.isRequired,
        })),
      });
    }

    // Update workflow fields
    const workflow = await prisma.approvalWorkflow.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

// DELETE /api/approvals/[id] - Delete workflow
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

    await prisma.approvalWorkflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
