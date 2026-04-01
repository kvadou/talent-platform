import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DayOfWeek } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const DAYS_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DaySchedule {
  dayOfWeek: string;
  isEnabled: boolean;
  slots: TimeSlot[];
}

const timeSlotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
});

const dayScheduleSchema = z.object({
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  isEnabled: z.boolean(),
  slots: z.array(timeSlotSchema).min(1),
});

const updateScheduleSchema = z.object({
  schedule: z.array(dayScheduleSchema),
});

/**
 * GET /api/account/availability
 * Get the current user's weekly availability schedule
 */
export async function GET() {
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

  // Fetch all availability slots for this user
  const availability = await prisma.recruiterAvailability.findMany({
    where: { userId: user.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  // Group by day and transform to expected format
  const scheduleMap = new Map<DayOfWeek, DaySchedule>();

  // Initialize all days with defaults
  for (const day of DAYS_ORDER) {
    scheduleMap.set(day, {
      dayOfWeek: day,
      isEnabled: !['SATURDAY', 'SUNDAY'].includes(day),
      slots: [{ startTime: '09:00', endTime: '17:00' }],
    });
  }

  // Group existing availability by day
  const dayGroups = new Map<DayOfWeek, typeof availability>();
  for (const slot of availability) {
    const existing = dayGroups.get(slot.dayOfWeek) || [];
    existing.push(slot);
    dayGroups.set(slot.dayOfWeek, existing);
  }

  // Update schedule with actual data
  for (const [day, slots] of dayGroups) {
    const isEnabled = slots.some((s) => s.isEnabled);
    scheduleMap.set(day, {
      dayOfWeek: day,
      isEnabled,
      slots: slots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
  }

  // Convert to ordered array
  const schedule = DAYS_ORDER.map((day) => scheduleMap.get(day)!);

  return NextResponse.json({ schedule });
}

/**
 * PUT /api/account/availability
 * Update the current user's weekly availability schedule
 */
export async function PUT(request: Request) {
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

  const body = await request.json();
  const validation = updateScheduleSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { schedule } = validation.data;

  // Delete all existing availability for this user
  await prisma.recruiterAvailability.deleteMany({
    where: { userId: user.id },
  });

  // Create new availability records
  const newRecords = schedule.flatMap((day) =>
    day.slots.map((slot) => ({
      userId: user.id,
      dayOfWeek: day.dayOfWeek as DayOfWeek,
      isEnabled: day.isEnabled,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
  );

  await prisma.recruiterAvailability.createMany({
    data: newRecords,
  });

  return NextResponse.json({ success: true });
}
