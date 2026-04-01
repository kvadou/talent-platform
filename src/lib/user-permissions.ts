import { UserRole } from '@prisma/client';
import { prisma } from './prisma';

export async function getUserWithMarkets(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      role: true,
      marketAccess: { select: { marketId: true } }
    }
  });
}

export function canManageJob(role: UserRole) {
  return role === UserRole.HQ_ADMIN || role === UserRole.MARKET_ADMIN || role === UserRole.RECRUITER;
}

export function canViewReadOnly(role: UserRole) {
  return role === UserRole.HIRING_MANAGER;
}
