import { NextResponse } from 'next/server';
import { extractContactInfo } from '@/lib/resume-parser';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req);
    const limitResult = await rateLimit(`resume-parse:${ip}`, 20, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { s3Key } = await req.json();

    if (!s3Key || typeof s3Key !== 'string') {
      return NextResponse.json(
        { error: 'Missing s3Key parameter' },
        { status: 400 }
      );
    }
    if (!s3Key.startsWith('resumes/')) {
      return NextResponse.json({ error: 'Invalid s3Key' }, { status: 400 });
    }

    // Extract contact info (quick parsing for form auto-fill)
    const contactInfo = await extractContactInfo(s3Key);

    return NextResponse.json({
      success: true,
      data: contactInfo,
    });
  } catch (error) {
    console.error('Resume parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse resume', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
