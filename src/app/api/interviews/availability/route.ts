import { NextResponse } from 'next/server';
import { getSession, ensureUser } from '@/lib/auth';
import { getAvailableTimeSlots } from '@/lib/google-calendar';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const interviewerId = searchParams.get('interviewerId');
  const interviewerEmail = searchParams.get('interviewerEmail'); // Optional: direct email for service account
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const duration = searchParams.get('duration');

  if ((!interviewerId && !interviewerEmail) || !startDate || !endDate || !duration) {
    return NextResponse.json(
      { error: 'Missing required parameters: interviewerId or interviewerEmail, startDate, endDate, duration' },
      { status: 400 }
    );
  }

  try {
    const dbUser = await ensureUser();
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get interviewer email(s) - prefer provided email, otherwise fetch from database
    let interviewerEmails: string[] = [];
    
    if (interviewerEmail) {
      interviewerEmails = [interviewerEmail];
    } else if (interviewerId) {
      const interviewer = await prisma.user.findUnique({
        where: { id: interviewerId },
        select: { email: true }
      });
      if (interviewer?.email) {
        interviewerEmails = [interviewer.email];
      }
    }

    // Get available slots for the interviewer
    const slots = await getAvailableTimeSlots(
      dbUser.id, // Requesting user (for fallback OAuth)
      interviewerId ? [interviewerId] : [], // Interviewer IDs (for OAuth fallback)
      parseInt(duration, 10),
      new Date(startDate),
      new Date(endDate),
      15, // bufferBefore
      15, // bufferAfter
      interviewerEmails.length > 0 ? interviewerEmails : undefined // Use service account if emails provided
    );

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Failed to get availability:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get availability',
        details: error instanceof Error && error.message.includes('not connected')
          ? 'Google Calendar not connected. Please connect your calendar in Settings or configure Service Account.'
          : undefined,
      },
      { status: 500 }
    );
  }
}