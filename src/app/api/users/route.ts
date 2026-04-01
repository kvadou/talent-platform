import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getUserOrganization } from '@/lib/market-scope';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await getUserOrganization(session.user.email);
  if (!org) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: { organizationId: org.id },
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
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  // With Google SSO, all users in the database are active
  const usersWithStatus = users.map((user) => ({
    ...user,
    isActive: true,
  }));

  return NextResponse.json({ users: usersWithStatus });
}
