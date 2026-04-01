import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

type RoleInfo = {
  role: UserRole;
  name: string;
  description: string;
  userCount: number;
  isSystem: boolean;
};

// Human-readable role names and descriptions
const ROLE_META: Record<UserRole, { name: string; description: string }> = {
  HQ_ADMIN: {
    name: 'HQ Admin',
    description: 'Full access to all features and markets',
  },
  MARKET_ADMIN: {
    name: 'Market Admin',
    description: 'Full access within assigned markets',
  },
  RECRUITER: {
    name: 'Recruiter',
    description: 'Can manage jobs and candidates',
  },
  HIRING_MANAGER: {
    name: 'Hiring Manager',
    description: 'Can view and provide feedback on candidates',
  },
};

// GET /api/permissions - Get role statistics
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count users per role
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const roleCountMap = new Map(
      roleCounts.map((rc) => [rc.role, rc._count.id])
    );

    // Build response with all roles
    const roles: RoleInfo[] = Object.values(UserRole).map((role) => ({
      role,
      name: ROLE_META[role].name,
      description: ROLE_META[role].description,
      userCount: roleCountMap.get(role) ?? 0,
      isSystem: true, // All roles are system-defined in this model
    }));

    // Sort by hierarchy (HQ_ADMIN first)
    const roleOrder = ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
    roles.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

    const totals = {
      totalUsers: roles.reduce((sum, r) => sum + r.userCount, 0),
      totalRoles: roles.length,
    };

    return NextResponse.json({ roles, totals });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
