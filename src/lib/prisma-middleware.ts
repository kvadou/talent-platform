import { Prisma } from '@prisma/client';
import { getUserMarkets } from './market-scope';
import { prisma } from './prisma';

// Example middleware hook: call during request handlers when user context is available
export async function applyMarketScope(email: string) {
  const access = await getUserMarkets(email);
  prisma.$use(async (params, next) => {
    // Only scope find operations when applicable
    const operations = ['findUnique', 'findFirst', 'findMany'];
    if (!operations.includes(params.action)) return next(params);
    if (access.marketIds === null) return next(params);

    if (params.model === 'Job' || params.model === 'Application') {
      const where = (params.args?.where ?? {}) as Prisma.JobWhereInput & Prisma.ApplicationWhereInput;
      params.args = { ...params.args, where: { ...where, marketId: { in: access.marketIds } } };
    }

    return next(params);
  });
}
