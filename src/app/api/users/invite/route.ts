import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getUserOrganization } from '@/lib/market-scope';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get inviting user's organization
    const org = await getUserOrganization(session.user.email);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to invite (HQ_ADMIN or MARKET_ADMIN)
    const invitingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!invitingUser || !['HQ_ADMIN', 'MARKET_ADMIN'].includes(invitingUser.role)) {
      return NextResponse.json({ error: 'Not authorized to invite users' }, { status: 403 });
    }

    const body = await req.json();
    const { email, firstName, lastName, role, marketIds } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate role
    const validRoles = ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Create user in our database - they will be able to sign in via Google SSO
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim() || 'Invited',
        lastName: lastName?.trim() || 'User',
        role: role || 'RECRUITER',
        organizationId: org.id,
        // Create market access if marketIds provided
        ...(marketIds?.length > 0 && {
          marketAccess: {
            create: marketIds.map((marketId: string) => ({
              marketId,
            })),
          },
        }),
      },
      include: {
        marketAccess: {
          include: {
            market: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: false,
        marketAccess: newUser.marketAccess,
      },
      message: 'User created successfully. They can sign in via Google SSO.',
    });
  } catch (error) {
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    );
  }
}
