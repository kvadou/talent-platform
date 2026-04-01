import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// POST - Generate a reschedule token for an interview
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      application: true
    }
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  // Generate token and find/create scheduling link
  const token = randomBytes(24).toString('hex');

  const schedulingLink = await prisma.schedulingLink.create({
    data: {
      applicationId: interview.applicationId,
      stageId: interview.application.stageId,
      token,
      interviewerIds: [interview.interviewerId],
      duration: interview.duration,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const rescheduleUrl = `${baseUrl}/reschedule/${token}?interviewId=${id}`;

  return NextResponse.json({
    token,
    url: rescheduleUrl,
    expiresAt: schedulingLink.expiresAt
  });
}
