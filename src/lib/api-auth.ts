import { NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { getSession, ensureUser, DEMO_MODE } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMarkets } from '@/lib/market-scope';

export type ApiUserContext = {
  email: string;
  id: string;
  role: UserRole;
  organizationId: string;
};

export async function requireApiUser(): Promise<ApiUserContext | NextResponse> {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // In demo mode, ensure the demo user exists in DB
  if (DEMO_MODE) {
    const user = await ensureUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
}

export function requireAnyRole(
  ctx: ApiUserContext,
  roles: UserRole[]
): NextResponse | null {
  if (!roles.includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function canAccessApplication(
  userEmail: string,
  applicationId: string
): Promise<boolean> {
  const access = await getUserMarkets(userEmail);
  const app = await prisma.application.findFirst({
    where: {
      id: applicationId,
      ...(access.marketIds ? { job: { marketId: { in: access.marketIds } } } : {}),
    },
    select: { id: true },
  });
  return !!app;
}

export async function canAccessJob(
  userEmail: string,
  jobId: string
): Promise<boolean> {
  const access = await getUserMarkets(userEmail);
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      ...(access.marketIds ? { marketId: { in: access.marketIds } } : {}),
    },
    select: { id: true },
  });
  return !!job;
}
