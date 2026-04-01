import { NextResponse } from 'next/server';
import { exportHiredCandidates } from '@/lib/integrations/contractor-export';
import { requireApiUser, requireAnyRole } from '@/lib/api-auth';

export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireAnyRole(auth, ['HQ_ADMIN']);
  if (forbidden) return forbidden;

  await exportHiredCandidates();
  return NextResponse.json({ message: 'Export started' });
}
