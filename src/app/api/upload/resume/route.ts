import { NextResponse } from 'next/server';
import { getResumeUploadUrl } from '@/lib/s3';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limitResult = await rateLimit(`resume-upload-url:${ip}`, 30, 60_000);
  if (!limitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { contentType } = await req.json();
  if (!contentType) return NextResponse.json({ error: 'contentType required' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT' }, { status: 400 });
  }

  const upload = await getResumeUploadUrl(contentType);
  return NextResponse.json(upload);
}
