'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

const DEMO_SESSION = {
  user: {
    id: 'demo-user',
    email: 'demo@acmetalent.com',
    name: 'Demo User',
    image: null,
    role: 'HQ_ADMIN',
  },
  expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  return (
    <NextAuthSessionProvider session={demoMode ? DEMO_SESSION as any : undefined}>
      {children}
    </NextAuthSessionProvider>
  );
}
