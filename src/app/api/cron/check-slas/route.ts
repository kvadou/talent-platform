import { NextResponse } from 'next/server';
import { checkSlaBreaches } from '@/lib/automation/sla-monitor';
import crypto from 'crypto';

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkSlaBreaches();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error checking SLAs:', error);
    return NextResponse.json({ error: 'Failed to check SLAs' }, { status: 500 });
  }
}

