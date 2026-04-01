import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateProfileSchema = z.object({
  schedulingUsername: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed')
    .nullable()
    .optional(),
  timezone: z.string().optional(),
});

/**
 * GET /api/account/profile
 * Get the current user's profile
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      schedulingUsername: true,
      timezone: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

/**
 * PUT /api/account/profile
 * Update the current user's profile
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, schedulingUsername: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();
  const validation = updateProfileSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { schedulingUsername, timezone } = validation.data;

  // Check if username is being changed and if it's available
  if (schedulingUsername && schedulingUsername !== user.schedulingUsername) {
    const existingUser = await prisma.user.findUnique({
      where: { schedulingUsername },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== user.id) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(schedulingUsername !== undefined && { schedulingUsername }),
      ...(timezone !== undefined && { timezone }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      schedulingUsername: true,
      timezone: true,
      role: true,
    },
  });

  return NextResponse.json(updated);
}
