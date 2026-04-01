import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getResumeDownloadUrl } from '@/lib/s3';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    select: { resumeUrl: true, firstName: true, lastName: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  if (!candidate.resumeUrl) {
    return NextResponse.json({ error: 'No resume on file' }, { status: 404 });
  }

  try {
    // resumeUrl stores the S3 key (e.g., "resumes/uuid.pdf")
    const signedUrl = await getResumeDownloadUrl(candidate.resumeUrl);
    return NextResponse.json({
      url: signedUrl,
      filename: `${candidate.firstName}_${candidate.lastName}_Resume.pdf`
    });
  } catch (error) {
    console.error('Failed to generate resume URL:', error);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
}
