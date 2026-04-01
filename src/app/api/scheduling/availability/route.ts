import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DayOfWeek } from '@prisma/client';

const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

// GET /api/scheduling/availability - Get user's availability
export async function GET() {
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

    // Get existing availability
    const availability = await prisma.recruiterAvailability.findMany({
      where: { userId: user.id },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Get schedule exceptions
    const exceptions = await prisma.scheduleException.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    });

    // If no availability set, return defaults
    if (availability.length === 0) {
      const defaultAvailability = DAYS.map((day) => ({
        dayOfWeek: day,
        isEnabled: day !== 'SATURDAY' && day !== 'SUNDAY',
        startTime: '09:00',
        endTime: '17:00',
      }));

      return NextResponse.json({
        availability: defaultAvailability,
        exceptions: exceptions.map((e) => ({
          id: e.id,
          date: e.date.toISOString().split('T')[0],
          isAvailable: e.isAvailable,
          startTime: e.startTime,
          endTime: e.endTime,
          reason: e.reason,
        })),
      });
    }

    return NextResponse.json({
      availability: availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        isEnabled: a.isEnabled,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        date: e.date.toISOString().split('T')[0],
        isAvailable: e.isAvailable,
        startTime: e.startTime,
        endTime: e.endTime,
        reason: e.reason,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

// POST /api/scheduling/availability - Save user's availability
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

    const { availability } = await request.json();

    if (!Array.isArray(availability)) {
      return NextResponse.json({ error: 'Invalid availability data' }, { status: 400 });
    }

    // Replace existing entries for each day (schema allows multiple slots/day, so no unique upsert key)
    const writes = availability.map((day: {
      dayOfWeek: DayOfWeek;
      isEnabled: boolean;
      startTime: string;
      endTime: string;
    }) =>
      prisma.$transaction([
        prisma.recruiterAvailability.deleteMany({
          where: {
            userId: user.id,
            dayOfWeek: day.dayOfWeek,
          },
        }),
        prisma.recruiterAvailability.create({
          data: {
            userId: user.id,
            dayOfWeek: day.dayOfWeek,
            isEnabled: day.isEnabled,
            startTime: day.startTime,
            endTime: day.endTime,
          },
        }),
      ])
    );

    await Promise.all(writes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save availability:', error);
    return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 });
  }
}
