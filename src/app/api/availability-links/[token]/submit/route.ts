import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AvailabilityWindow {
  date: string;
  startTime: string;
  endTime: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { windows, timezone, note } = body as {
    windows: AvailabilityWindow[];
    timezone: string;
    note?: string;
  };

  if (!windows || !Array.isArray(windows) || windows.length === 0) {
    return NextResponse.json({ error: 'At least one availability window is required' }, { status: 400 });
  }

  const link = await prisma.availabilityLink.findUnique({
    where: { token },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true, email: true } },
          job: { select: { title: true } }
        }
      }
    }
  });

  if (!link) {
    return NextResponse.json({ error: 'Invalid availability link' }, { status: 404 });
  }

  if (link.status !== 'PENDING') {
    return NextResponse.json({ error: 'Availability has already been submitted' }, { status: 400 });
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    await prisma.availabilityLink.update({
      where: { id: link.id },
      data: { status: 'EXPIRED' }
    });
    return NextResponse.json({ error: 'This availability link has expired' }, { status: 410 });
  }

  // Validate and convert windows to proper datetime
  const availabilityData: { startTime: Date; endTime: Date; note: string | null }[] = [];

  for (const window of windows) {
    // Parse date and times
    const [year, month, day] = window.date.split('-').map(Number);
    const [startHour, startMin] = window.startTime.split(':').map(Number);
    const [endHour, endMin] = window.endTime.split(':').map(Number);

    // Create dates in the specified timezone
    // Note: We store as UTC but the candidate's timezone is noted
    const startTime = new Date(year, month - 1, day, startHour, startMin);
    const endTime = new Date(year, month - 1, day, endHour, endMin);

    if (endTime <= startTime) {
      return NextResponse.json({
        error: `End time must be after start time for ${window.date}`
      }, { status: 400 });
    }

    availabilityData.push({
      startTime,
      endTime,
      note: note || null
    });
  }

  // Create all availability windows and update link status
  await prisma.$transaction(async (tx) => {
    // Create availability entries
    await tx.candidateAvailability.createMany({
      data: availabilityData.map(a => ({
        availabilityLinkId: link.id,
        startTime: a.startTime,
        endTime: a.endTime,
        note: a.note
      }))
    });

    // Update link status
    await tx.availabilityLink.update({
      where: { id: link.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        timezone: timezone || link.timezone
      }
    });
  });

  return NextResponse.json({ success: true });
}
