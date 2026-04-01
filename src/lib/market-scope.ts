import { prisma } from './prisma';
import { UserRole } from '@prisma/client';

export type MarketAccess = {
  marketIds: string[] | null; // null = all markets
};

export async function getUserMarkets(userEmail: string): Promise<MarketAccess> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      role: true,
      marketAccess: { select: { marketId: true } }
    }
  });
  if (!user) throw new Error('User not found');
  if (user.role === UserRole.HQ_ADMIN) return { marketIds: null };
  return { marketIds: user.marketAccess.map((m) => m.marketId) };
}

export function canAccessMarket(access: MarketAccess, marketId: string): boolean {
  if (access.marketIds === null) return true;
  return access.marketIds.includes(marketId);
}

export function scopeWhere<T extends { marketId?: string; job?: { marketId?: string } }>(
  access: MarketAccess,
  where: T
): T {
  if (access.marketIds === null) return where;
  return {
    ...where,
    marketId: where.marketId ?? undefined,
    job: where.job ?? undefined,
    ...(where.marketId || where.job?.marketId
      ? {}
      : { marketId: { in: access.marketIds } as unknown as string })
  };
}

export async function assertMarketAccess(userEmail: string, marketId: string) {
  const access = await getUserMarkets(userEmail);
  if (!canAccessMarket(access, marketId)) {
    throw new Error('Forbidden: market access denied');
  }
}

export async function getUserOrganization(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      organizationId: true,
      organization: {
        select: { id: true, name: true },
      },
    },
  });
  return user?.organization ?? null;
}
