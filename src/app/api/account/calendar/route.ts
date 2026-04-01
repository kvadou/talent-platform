import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/account/calendar - Get calendar integration status
export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const google = await prisma.calendarIntegration.findUnique({
    where: {
      userId_provider: {
        userId: dbUser.id,
        provider: 'google',
      },
    },
    select: {
      id: true,
      provider: true,
      calendarId: true,
      isActive: true,
    },
  });

  return NextResponse.json({ google: google || null });
}

// DELETE /api/account/calendar - Disconnect Google Calendar
export async function DELETE() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.calendarIntegration.deleteMany({
    where: {
      userId: dbUser.id,
      provider: 'google',
    },
  });

  return NextResponse.json({ success: true });
}
