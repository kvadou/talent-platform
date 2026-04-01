export const dynamic = 'force-dynamic';

import { ReactNode } from 'react';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/Header';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

async function getMarkets(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      role: true,
      marketAccess: { select: { market: { select: { id: true, name: true, slug: true } } } }
    }
  });
  if (!user) return [] as { id: string; name: string }[];
  if (user.role === UserRole.HQ_ADMIN) {
    const markets = await prisma.market.findMany({ select: { id: true, name: true } });
    return markets;
  }
  return user.marketAccess.map((m) => ({ id: m.market.id, name: m.market.name }));
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user?.email) {
    redirect('/login');
  }
  await ensureUser();
  const markets = await getMarkets(session.user.email);
  const currentMarketId = markets[0]?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      <Header markets={markets} currentMarketId={currentMarketId} />
      <main className="pt-16 sm:pt-20 pb-6 sm:pb-8 px-3 sm:px-6 lg:px-10 max-w-[1600px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
