import { NextResponse } from 'next/server';
import { processSequences } from '@/lib/automation/sequence-processor';
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
    await processSequences();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing sequences:', error);
    return NextResponse.json({ error: 'Failed to process sequences' }, { status: 500 });
  }
}

