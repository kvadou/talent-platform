import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAvailableTimeSlots } from '@/lib/google-calendar';
import { hashToken } from '@/lib/tokens';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = hashToken(rawToken);
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const link = await prisma.schedulingLink.findUnique({
    where: { token }
  });
  
  if (!link || link.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Invalid or expired scheduling link' }, { status: 404 });
  }
  
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Scheduling link has expired' }, { status: 410 });
  }
  
  // Fetch interviewer emails for service account access
  const interviewers = await prisma.user.findMany({
    where: { id: { in: link.interviewerIds } },
    select: { email: true }
  });
  const interviewerEmails = interviewers.map(u => u.email).filter(Boolean) as string[];

  // Get available slots using service account (if configured) or OAuth fallback
  const slots = await getAvailableTimeSlots(
    link.interviewerIds[0] || '', // Primary interviewer (for OAuth fallback)
    link.interviewerIds,
    link.duration,
    new Date(startDate),
    new Date(endDate),
    link.bufferBefore,
    link.bufferAfter,
    interviewerEmails.length > 0 ? interviewerEmails : undefined // Use service account if emails available
  );
  
  // Filter by minNoticeHours and maxDaysOut
  const now = new Date();
  const minTime = new Date(now.getTime() + link.minNoticeHours * 60 * 60 * 1000);
  const maxTime = new Date(now.getTime() + link.maxDaysOut * 24 * 60 * 60 * 1000);
  
  const filteredSlots = slots.filter((slot) => {
    return slot.start >= minTime && slot.start <= maxTime;
  });
  
  return NextResponse.json({ slots: filteredSlots });
}

