import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

// GET /api/interviewer-groups/[id] - Get a specific group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const group = await prisma.interviewerGroup.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        members: group.members.map((m) => ({
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
        })),
        memberCount: group.members.length,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching interviewer group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviewer group' },
      { status: 500 }
    );
  }
}

// PUT /api/interviewer-groups/[id] - Update a group
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, memberIds } = parsed.data;

    // Update group and members in a transaction
    const group = await prisma.$transaction(async (tx) => {
      // Update group details
      const updatedGroup = await tx.interviewerGroup.update({
        where: { id: params.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      });

      // If memberIds provided, sync members
      if (memberIds !== undefined) {
        // Delete existing members
        await tx.interviewerGroupMember.deleteMany({
          where: { groupId: params.id },
        });

        // Add new members
        if (memberIds.length > 0) {
          await tx.interviewerGroupMember.createMany({
            data: memberIds.map((userId) => ({
              groupId: params.id,
              userId,
            })),
          });
        }
      }

      // Return updated group with members
      return tx.interviewerGroup.findUnique({
        where: { id: params.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        members: group.members.map((m) => ({
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
        })),
        memberCount: group.members.length,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error('Error updating interviewer group:', error);
    return NextResponse.json(
      { error: 'Failed to update interviewer group' },
      { status: 500 }
    );
  }
}

// DELETE /api/interviewer-groups/[id] - Delete a group
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.interviewerGroup.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting interviewer group:', error);
    return NextResponse.json(
      { error: 'Failed to delete interviewer group' },
      { status: 500 }
    );
  }
}
