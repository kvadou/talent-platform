import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getUserOrganization } from '@/lib/market-scope';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: params.id,
      organizationId: org.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      marketAccess: {
        select: {
          market: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      ...user,
      isActive: true, // With Google SSO, all users in DB are active
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrganization(session.user.email);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission to edit (HQ_ADMIN or MARKET_ADMIN)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!currentUser || !['HQ_ADMIN', 'MARKET_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Not authorized to edit users' }, { status: 403 });
    }

    // Verify target user belongs to same org
    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: org.id,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { firstName, lastName, role, marketIds } = body;

    // Validate role if provided
    const validRoles = ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Update user basic info
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(firstName !== undefined && { firstName: firstName?.trim() || null }),
        ...(lastName !== undefined && { lastName: lastName?.trim() || null }),
        ...(role && { role }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        marketAccess: {
          select: {
            market: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Update market access if provided
    if (marketIds !== undefined) {
      // Delete existing market access
      await prisma.userMarket.deleteMany({
        where: { userId: params.id },
      });

      // Create new market access
      if (marketIds.length > 0) {
        await prisma.userMarket.createMany({
          data: marketIds.map((marketId: string) => ({
            userId: params.id,
            marketId,
          })),
        });
      }

      // Refetch user with updated market access
      const userWithMarkets = await prisma.user.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
          marketAccess: {
            select: {
              market: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        user: {
          ...userWithMarkets,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      user: {
        ...updatedUser,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrganization(session.user.email);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user has permission (HQ_ADMIN only can delete)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, id: true },
    });

    if (!currentUser || currentUser.role !== 'HQ_ADMIN') {
      return NextResponse.json({ error: 'Only HQ Admin can delete users' }, { status: 403 });
    }

    // Verify target user belongs to same org and isn't self
    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: org.id,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Delete market access first
    await prisma.userMarket.deleteMany({
      where: { userId: params.id },
    });

    // Delete user
    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
