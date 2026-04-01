import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const integration = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId: dbUser.id,
        provider: 'google'
      }
    }
  });

  return NextResponse.json({
    connected: integration?.isActive || false
  });
}

