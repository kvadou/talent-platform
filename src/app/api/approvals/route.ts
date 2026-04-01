import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createWorkflowSchema = z.object({
  type: z.enum(['JOB_APPROVAL', 'OFFER_APPROVAL']),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  steps: z.array(
    z.object({
      name: z.string().min(1),
      approverIds: z.array(z.string()),
      isRequired: z.boolean().default(true),
    })
  ),
});

// GET /api/approvals - List all approval workflows
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflows = await prisma.approvalWorkflow.findMany({
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Get users for approverIds
    const userIds = workflows.flatMap((w) => w.steps.flatMap((s) => s.approverIds));
    const uniqueUserIds = [...new Set(userIds.filter((id) => !id.startsWith('role:')))];

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });

    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Transform workflows with user info
    const workflowsWithInfo = workflows.map((workflow) => ({
      id: workflow.id,
      type: workflow.type,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      createdAt: workflow.createdAt,
      stepCount: workflow.steps.length,
      steps: workflow.steps.map((step) => ({
        id: step.id,
        order: step.order,
        name: step.name,
        isRequired: step.isRequired,
        approverIds: step.approverIds,
        approvers: step.approverIds.map((id) => {
          if (id.startsWith('role:')) {
            return { id, type: 'role', name: id.replace('role:', '') };
          }
          const user = usersMap.get(id);
          return user
            ? { id, type: 'user', name: `${user.firstName} ${user.lastName}`, email: user.email }
            : { id, type: 'user', name: 'Unknown User' };
        }),
      })),
    }));

    return NextResponse.json({ workflows: workflowsWithInfo });
  } catch (error) {
    console.error('Error fetching approval workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval workflows' },
      { status: 500 }
    );
  }
}

// POST /api/approvals - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        type: parsed.data.type,
        name: parsed.data.name,
        description: parsed.data.description,
        steps: {
          create: parsed.data.steps.map((step, index) => ({
            order: index + 1,
            name: step.name,
            approverIds: step.approverIds,
            isRequired: step.isRequired,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
