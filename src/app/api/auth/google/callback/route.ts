import { NextResponse } from 'next/server';
import { handleGoogleCallback } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/settings?error=missing_params`);
  }

  try {
    await handleGoogleCallback(code, state);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/calendar?success=google_connected`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account/calendar?error=oauth_failed`);
  }
}

