import { UserRole } from '@prisma/client';
import { prisma } from './prisma';

const rolePriority: Record<UserRole, number> = {
  [UserRole.HQ_ADMIN]: 3,
  [UserRole.MARKET_ADMIN]: 2,
  [UserRole.RECRUITER]: 1,
  [UserRole.HIRING_MANAGER]: 0
};

export async function getUserRole(email: string): Promise<UserRole> {
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (!user) throw new Error('User not found');
  return user.role;
}

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return rolePriority[userRole] >= rolePriority[required];
}

export async function assertRole(email: string, required: UserRole) {
  const role = await getUserRole(email);
  if (!hasRole(role, required)) {
    throw new Error('Forbidden: insufficient role');
  }
}
