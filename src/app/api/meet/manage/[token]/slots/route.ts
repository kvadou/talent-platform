import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DayOfWeek } from '@prisma/client';
import { hashToken } from '@/lib/tokens';
import { getCalendarClient } from '@/lib/google-calendar';

interface RouteParams {
  params: { token: string };
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

function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

function startOfDayInTimezone(dateStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const roughDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, roughDate);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60000);
}

/**
 * GET /api/meet/manage/[token]/slots?date=YYYY-MM-DD
 * Get available slots for rescheduling. Excludes the current meeting time from blocked ranges.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const tokenHash = hashToken(token);
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Date parameter required (YYYY-MM-DD)' }, { status: 400 });
  }

  // Find meeting by token
  const meeting = await prisma.scheduledMeeting.findUnique({
    where: { manageTokenHash: tokenHash },
    include: {
      meetingType: {
        select: { id: true, duration: true, slotIncrement: true, bufferBefore: true, bufferAfter: true, minNoticeHours: true },
      },
      host: { select: { id: true, timezone: true } },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  if (meeting.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Meeting is not confirmed' }, { status: 400 });
  }

  const userId = meeting.host.id;
  const timezone = meeting.host.timezone || 'America/Chicago';
  const meetingType = meeting.meetingType;

  const dayStartUtc = startOfDayInTimezone(dateStr, timezone);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_MAP[localDate.getDay()];

  // Get availability
  const availability = await prisma.recruiterAvailability.findMany({
    where: { userId, dayOfWeek, isEnabled: true },
    orderBy: { startTime: 'asc' },
  });

  if (availability.length === 0) {
    return NextResponse.json({ slots: [], timezone });
  }

  // Check exceptions
  const exceptionDate = new Date(Date.UTC(year, month - 1, day));
  const exception = await prisma.scheduleException.findUnique({
    where: { userId_date: { userId, date: exceptionDate } },
  });

  if (exception && !exception.isAvailable) {
    return NextResponse.json({ slots: [], timezone });
  }

  // Get existing interviews
  const existingInterviews = await prisma.interview.findMany({
    where: {
      interviewerId: userId,
      scheduledAt: { gte: dayStartUtc, lte: dayEndUtc },
    },
    select: { scheduledAt: true, duration: true },
  });

  // Get existing meetings — but EXCLUDE the current meeting being rescheduled
  const existingMeetings = await prisma.scheduledMeeting.findMany({
    where: {
      hostId: userId,
      status: 'CONFIRMED',
      id: { not: meeting.id },
      scheduledAt: { gte: dayStartUtc, lte: dayEndUtc },
    },
    select: { scheduledAt: true, duration: true },
  });

  const tzOffset = getTimezoneOffsetMinutes(timezone, dayStartUtc);
  const blockedRanges: { start: number; end: number }[] = [];

  for (const interview of existingInterviews) {
    const utcMinutes = interview.scheduledAt.getUTCHours() * 60 + interview.scheduledAt.getUTCMinutes();
    const localMinutes = utcMinutes + tzOffset;
    blockedRanges.push({
      start: localMinutes - meetingType.bufferBefore,
      end: localMinutes + (interview.duration || 60) + meetingType.bufferAfter,
    });
  }

  for (const mtg of existingMeetings) {
    const utcMinutes = mtg.scheduledAt.getUTCHours() * 60 + mtg.scheduledAt.getUTCMinutes();
    const localMinutes = utcMinutes + tzOffset;
    blockedRanges.push({
      start: localMinutes - meetingType.bufferBefore,
      end: localMinutes + mtg.duration + meetingType.bufferAfter,
    });
  }

  // Check Google Calendar
  try {
    const calendar = await getCalendarClient(userId);
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'google' } },
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
  } catch {
    // Google Calendar not connected
  }

  // Generate slots
  const slots: { time: string; label: string }[] = [];
  const nowUtc = new Date();
  const nowLocalMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + tzOffset;
  const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(nowUtc);
  const isToday = dateStr === todayInTz;
  const minNoticeCutoff = isToday ? nowLocalMinutes + meetingType.minNoticeHours * 60 : -Infinity;

  for (const slot of availability) {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);

    for (let time = startMinutes; time + meetingType.duration <= endMinutes; time += meetingType.slotIncrement) {
      const slotEnd = time + meetingType.duration;
      const isBlocked = blockedRanges.some((range) => time < range.end && slotEnd > range.start);
      if (isBlocked) continue;
      if (time < minNoticeCutoff) continue;

      const timeStr = minutesToTime(time);
      slots.push({ time: timeStr, label: formatTime12(timeStr) });
    }
  }

  return NextResponse.json({ slots, timezone });
}
