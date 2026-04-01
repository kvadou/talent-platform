import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/scheduling/exceptions - Add a new exception
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { date, isAvailable, startTime, endTime, reason } = await request.json();

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Check if exception already exists for this date
    const existing = await prisma.scheduleException.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: new Date(date),
        },
      },
    });

    if (existing) {
      // Update existing exception
      const updated = await prisma.scheduleException.update({
        where: { id: existing.id },
        data: {
          isAvailable: isAvailable ?? false,
          startTime: isAvailable ? startTime : null,
          endTime: isAvailable ? endTime : null,
          reason,
        },
      });

      return NextResponse.json({
        id: updated.id,
        date: updated.date.toISOString().split('T')[0],
        isAvailable: updated.isAvailable,
        startTime: updated.startTime,
        endTime: updated.endTime,
        reason: updated.reason,
      });
    }

    // Create new exception
    const exception = await prisma.scheduleException.create({
      data: {
        userId: user.id,
        date: new Date(date),
        isAvailable: isAvailable ?? false,
        startTime: isAvailable ? startTime : null,
        endTime: isAvailable ? endTime : null,
        reason,
      },
    });

    return NextResponse.json({
      id: exception.id,
      date: exception.date.toISOString().split('T')[0],
      isAvailable: exception.isAvailable,
      startTime: exception.startTime,
      endTime: exception.endTime,
      reason: exception.reason,
    });
  } catch (error) {
    console.error('Failed to create exception:', error);
    return NextResponse.json({ error: 'Failed to create exception' }, { status: 500 });
  }
}
