import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { getGoogleAuthUrl } from '@/lib/google-calendar';

export async function GET() {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await ensureUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const authUrl = getGoogleAuthUrl(dbUser.id);
  return NextResponse.json({ authUrl });
}

