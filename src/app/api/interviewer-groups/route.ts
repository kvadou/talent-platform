import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

// GET /api/interviewer-groups - List all interviewer groups
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await prisma.interviewerGroup.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    const formattedGroups = groups.map((group) => ({
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
    }));

    return NextResponse.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Error fetching interviewer groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviewer groups' },
      { status: 500 }
    );
  }
}

// POST /api/interviewer-groups - Create a new interviewer group
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, memberIds } = parsed.data;

    const group = await prisma.interviewerGroup.create({
      data: {
        name,
        description,
        members: memberIds?.length
          ? {
              create: memberIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
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
    console.error('Error creating interviewer group:', error);
    return NextResponse.json(
      { error: 'Failed to create interviewer group' },
      { status: 500 }
    );
  }
}
