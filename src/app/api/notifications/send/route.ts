import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/postmark';
import { requireAnyRole, requireApiUser } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER']);
  if (forbidden) return forbidden;

  const { type, payload } = await req.json();
  if (type === 'email') {
    await sendEmail(payload);
    return NextResponse.json({ status: 'queued' });
  }
  return NextResponse.json({ error: 'Unsupported notification type' }, { status: 400 });
}
