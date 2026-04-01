import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DayOfWeek } from '@prisma/client';
import { getCalendarClient } from '@/lib/google-calendar';

interface RouteParams {
  params: {
    username: string;
    meetingSlug: string;
  };
}

const DAY_MAP: { [key: number]: DayOfWeek } = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTime12(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get the UTC offset in minutes for a given timezone on a given date.
 * Positive = ahead of UTC (e.g. +60 for CET), negative = behind (e.g. -360 for CST).
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/**
 * Create a Date representing midnight of a given YYYY-MM-DD in the specified timezone,
 * expressed in UTC.
 */
function startOfDayInTimezone(dateStr: string, timezone: string): Date {
  // Parse the date parts
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create a rough UTC date for offset calculation
  const roughDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, roughDate);
  // Midnight in the timezone = midnight minus the offset in UTC
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60000);
}

/**
 * GET /api/meet/[username]/[meetingSlug]/slots?date=YYYY-MM-DD
 * Get available time slots for a specific date
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { username, meetingSlug } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Date parameter required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Find user by scheduling username
  const user = await prisma.user.findUnique({
    where: { schedulingUsername: username },
    select: { id: true, timezone: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const timezone = user.timezone || 'America/Chicago';

  // Find meeting type
  const meetingType = await prisma.meetingType.findFirst({
    where: {
      userId: user.id,
      slug: meetingSlug,
      isActive: true,
    },
    select: {
      id: true,
      duration: true,
      slotIncrement: true,
      bufferBefore: true,
      bufferAfter: true,
      minNoticeHours: true,
    },
  });

  if (!meetingType) {
    return NextResponse.json({ error: 'Meeting type not found' }, { status: 404 });
  }

  // Compute start/end of the requested day in UTC, using the recruiter's timezone
  const dayStartUtc = startOfDayInTimezone(dateStr, timezone);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Get day of week in the recruiter's timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_MAP[localDate.getDay()];

  // Get user's availability for this day
  const availability = await prisma.recruiterAvailability.findMany({
    where: {
      userId: user.id,
      dayOfWeek,
      isEnabled: true,
    },
    orderBy: { startTime: 'asc' },
  });

  if (availability.length === 0) {
    return NextResponse.json({ slots: [], timezone });
  }

  // Check for date-specific exceptions
  const exceptionDate = new Date(Date.UTC(year, month - 1, day));
  const exception = await prisma.scheduleException.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: exceptionDate,
      },
    },
  });

  if (exception && !exception.isAvailable) {
    return NextResponse.json({ slots: [], timezone });
  }

  // Get existing interviews for this user on this date
  const existingInterviews = await prisma.interview.findMany({
    where: {
      interviewerId: user.id,
      scheduledAt: {
        gte: dayStartUtc,
        lte: dayEndUtc,
      },
    },
    select: {
      scheduledAt: true,
      duration: true,
    },
  });

  // Get existing scheduled meetings for this user on this date
  const existingMeetings = await prisma.scheduledMeeting.findMany({
    where: {
      hostId: user.id,
      status: 'CONFIRMED',
      scheduledAt: {
        gte: dayStartUtc,
        lte: dayEndUtc,
      },
    },
    select: {
      scheduledAt: true,
      duration: true,
    },
  });

  // Convert to blocked time ranges (in recruiter-local minutes from midnight)
  const tzOffset = getTimezoneOffsetMinutes(timezone, dayStartUtc);

  const blockedRanges: { start: number; end: number }[] = [];

  for (const interview of existingInterviews) {
    const utcMinutes = interview.scheduledAt.getUTCHours() * 60 + interview.scheduledAt.getUTCMinutes();
    const localMinutes = utcMinutes + tzOffset;
    const endMinutes = localMinutes + (interview.duration || 60);
    blockedRanges.push({
      start: localMinutes - meetingType.bufferBefore,
      end: endMinutes + meetingType.bufferAfter,
    });
  }

  for (const meeting of existingMeetings) {
    const utcMinutes = meeting.scheduledAt.getUTCHours() * 60 + meeting.scheduledAt.getUTCMinutes();
    const localMinutes = utcMinutes + tzOffset;
    const endMinutes = localMinutes + meeting.duration;
    blockedRanges.push({
      start: localMinutes - meetingType.bufferBefore,
      end: endMinutes + meetingType.bufferAfter,
    });
  }

  // Also check Google Calendar busy times if connected
  try {
    const calendar = await getCalendarClient(user.id);
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId_provider: { userId: user.id, provider: 'google' } },
    });

    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStartUtc.toISOString(),
        timeMax: dayEndUtc.toISOString(),
        items: [{ id: integration?.calendarId || 'primary' }],
      },
    });

    const calendars = busyResponse.data.calendars || {};
    for (const cal of Object.values(calendars)) {
      for (const busy of (cal as { busy?: { start: string; end: string }[] }).busy || []) {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        const startLocal = busyStart.getUTCHours() * 60 + busyStart.getUTCMinutes() + tzOffset;
        const endLocal = busyEnd.getUTCHours() * 60 + busyEnd.getUTCMinutes() + tzOffset;
        blockedRanges.push({ start: startLocal, end: endLocal });
      }
    }
  } catch (gcalError) {
    console.error('[meet/slots] Google Calendar freebusy check failed:', gcalError instanceof Error ? gcalError.message : gcalError);
  }

  // Generate all possible slots based on availability
  const slots: { time: string; label: string }[] = [];

  // "Now" in recruiter's timezone (minutes from midnight)
  const nowUtc = new Date();
  const nowLocalMinutes =
    nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + tzOffset;

  // Check if the requested date is today in the recruiter's timezone
  const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(nowUtc); // YYYY-MM-DD
  const isToday = dateStr === todayInTz;

  // Min notice cutoff in local minutes
  const minNoticeCutoff = isToday ? nowLocalMinutes + meetingType.minNoticeHours * 60 : -Infinity;

  for (const slot of availability) {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);

    for (let time = startMinutes; time + meetingType.duration <= endMinutes; time += meetingType.slotIncrement) {
      const slotEnd = time + meetingType.duration;

      // Check if slot overlaps with any blocked range
      const isBlocked = blockedRanges.some(
        (range) => time < range.end && slotEnd > range.start
      );

      if (isBlocked) continue;

      // If today, check minimum notice
      if (time < minNoticeCutoff) continue;

      const timeStr = minutesToTime(time);
      slots.push({
        time: timeStr,
        label: formatTime12(timeStr),
      });
    }
  }

  return NextResponse.json({ slots, timezone });
}
