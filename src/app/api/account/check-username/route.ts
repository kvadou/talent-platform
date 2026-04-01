import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/account/check-username?username=xxx
 * Check if a scheduling username is available
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username || username.length < 3) {
    return NextResponse.json({ available: false, error: 'Username too short' });
  }

  // Validate format
  if (!/^[a-z0-9-]+$/.test(username)) {
    return NextResponse.json({ available: false, error: 'Invalid format' });
  }

  // Get current user to exclude from check
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, schedulingUsername: true },
  });

  // If it's the user's current username, it's available to them
  if (currentUser?.schedulingUsername === username) {
    return NextResponse.json({ available: true });
  }

  // Check if username exists
  const existingUser = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: { id: true },
  });

  return NextResponse.json({ available: !existingUser });
}
