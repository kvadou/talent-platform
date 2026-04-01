import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, isTokenExpired } from '@/lib/tokens';
import type { DayOfWeek } from '@prisma/client';
import { getRequestIp, rateLimit } from '@/lib/security/rate-limit';
import { getCalendarClient } from '@/lib/google-calendar';

// --- Timezone helpers (matching meet page approach) ---

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

function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

// GET - Fetch available time slots for an application
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getRequestIp(req);
    const limitResult = await rateLimit(`portal-slots:${ip}`, 120, 60_000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Get the application via hashed token
    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token: tokenHash },
      include: {
        application: {
          include: {
            job: {
              include: {
                market: {
                  include: { organization: true },
                },
              },
            },
            stage: true,
            schedulingLinks: {
              where: {
                status: 'ACTIVE' as const,
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
              include: { meetingType: true },
              orderBy: { createdAt: 'desc' as const },
              take: 1,
            },
          },
        },
      },
    });

    if (!tokenRecord || isTokenExpired(tokenRecord.createdAt, tokenRecord.expiresAt)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const application = tokenRecord.application;
    const organizationId = application.job.market.organizationId;

    // Find the recruiter to schedule with
    let recruiterId: string | null = null;
    const schedulingLink = application.schedulingLinks[0];

    if (schedulingLink && schedulingLink.interviewerIds.length > 0) {
      recruiterId = schedulingLink.interviewerIds[0];
    } else {
      const recruiterWithAvailability = await prisma.user.findFirst({
        where: {
          organizationId,
          recruiterAvailability: { some: { isEnabled: true } },
        },
        select: { id: true },
      });
      if (recruiterWithAvailability) {
        recruiterId = recruiterWithAvailability.id;
      }
    }

    if (!recruiterId) {
      const admin = await prisma.user.findFirst({
        where: {
          organizationId,
          role: { in: ['HQ_ADMIN', 'MARKET_ADMIN', 'RECRUITER'] },
        },
        select: { id: true },
      });
      if (!admin) {
        return NextResponse.json({ error: 'No available recruiters found' }, { status: 400 });
      }
      recruiterId = admin.id;
    }

    // Get recruiter's timezone
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      select: { id: true, firstName: true, lastName: true, timezone: true },
    });
    const timezone = recruiter?.timezone || 'America/Chicago';

    // Get recruiter's availability settings
    const availability = await prisma.recruiterAvailability.findMany({
      where: { userId: recruiterId },
    });

    // Get scheduling preferences
    const preferences = await prisma.schedulingPreferences.findUnique({
      where: { userId: recruiterId },
    });

    // Get meeting type
    let meetingType = schedulingLink?.meetingType;
    if (!meetingType) {
      meetingType = await prisma.meetingType.findFirst({
        where: { userId: recruiterId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const duration = schedulingLink?.duration || meetingType?.duration || 30;
    const slotIncrement = meetingType?.slotIncrement || 30;
    const minNoticeHours = schedulingLink?.minNoticeHours || meetingType?.minNoticeHours || 24;
    const maxDaysOut = schedulingLink?.maxDaysOut || meetingType?.maxDaysOut || 30;
    const bufferBefore = schedulingLink?.bufferBefore ?? meetingType?.bufferBefore ?? preferences?.defaultBufferBefore ?? 5;
    const bufferAfter = schedulingLink?.bufferAfter ?? meetingType?.bufferAfter ?? preferences?.defaultBufferAfter ?? 5;

    // Build availability map by day of week
    const availabilityByDay: Record<DayOfWeek, typeof availability[0] | undefined> = {
      SUNDAY: undefined, MONDAY: undefined, TUESDAY: undefined,
      WEDNESDAY: undefined, THURSDAY: undefined, FRIDAY: undefined, SATURDAY: undefined,
    };
    for (const avail of availability) {
      if (avail.isEnabled) availabilityByDay[avail.dayOfWeek] = avail;
    }

    // Default to Mon-Fri 9-5 if nothing configured
    if (availability.length === 0) {
      const defaultDays: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      for (const day of defaultDays) {
        availabilityByDay[day] = {
          id: 'default', userId: recruiterId, dayOfWeek: day,
          isEnabled: true, startTime: '09:00', endTime: '17:00',
          createdAt: new Date(), updatedAt: new Date(),
        };
      }
    }

    // Get schedule exceptions (holidays, vacation days)
    const exceptions = await prisma.scheduleException.findMany({
      where: { userId: recruiterId, date: { gte: startDate, lte: endDate } },
    });
    const exceptionsByDate: Record<string, typeof exceptions[0]> = {};
    for (const exc of exceptions) {
      exceptionsByDate[exc.date.toISOString().split('T')[0]] = exc;
    }

    // Generate slots day by day with proper timezone handling
    const allSlots: { start: string; end: string }[] = [];
    const now = new Date();
    const maxDate = new Date(now.getTime() + maxDaysOut * 24 * 60 * 60 * 1000);
    const effectiveEnd = endDate < maxDate ? endDate : maxDate;

    // "Now" in recruiter's local time
    const tzOffset = getTimezoneOffsetMinutes(timezone, now);
    const nowLocalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffset;
    const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);

    // Iterate day by day
    const currentDate = new Date(startDate);
    currentDate.setUTCHours(12, 0, 0, 0); // noon UTC to avoid DST edge cases

    while (currentDate <= effectiveEnd) {
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(currentDate);
      const [year, month, day] = dateStr.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const dayOfWeek = getDayOfWeek(localDate);

      // Check exceptions
      const exception = exceptionsByDate[dateStr];
      let dayAvailability = availabilityByDay[dayOfWeek];

      if (exception) {
        if (!exception.isAvailable) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        } else if (exception.startTime && exception.endTime) {
          dayAvailability = {
            ...dayAvailability,
            isEnabled: true, startTime: exception.startTime, endTime: exception.endTime,
          } as typeof availability[0];
        }
      }

      if (!dayAvailability?.isEnabled) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Generate slots for this day in recruiter's timezone
      const dayStartUtc = startOfDayInTimezone(dateStr, timezone);
      const dayTzOffset = getTimezoneOffsetMinutes(timezone, dayStartUtc);
      const isToday = dateStr === todayInTz;
      const minNoticeCutoff = isToday ? nowLocalMinutes + minNoticeHours * 60 : -Infinity;

      const startMinutes = timeToMinutes(dayAvailability.startTime);
      const endMinutes = timeToMinutes(dayAvailability.endTime);

      for (let time = startMinutes; time + duration <= endMinutes; time += slotIncrement) {
        // Skip if before minimum notice
        if (time < minNoticeCutoff) continue;

        // Convert local time to UTC for the slot
        const slotStartUtc = new Date(dayStartUtc.getTime() + time * 60000);
        const slotEndUtc = new Date(dayStartUtc.getTime() + (time + duration) * 60000);

        allSlots.push({
          start: slotStartUtc.toISOString(),
          end: slotEndUtc.toISOString(),
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Now filter out busy times from multiple sources

    // 1. Existing ATS interviews
    const existingInterviews = await prisma.interview.findMany({
      where: {
        interviewerId: recruiterId,
        scheduledAt: { gte: startDate, lte: effectiveEnd },
      },
    });

    // 2. Existing scheduled meetings
    const existingMeetings = await prisma.scheduledMeeting.findMany({
      where: {
        hostId: recruiterId,
        status: 'CONFIRMED',
        scheduledAt: { gte: startDate, lte: effectiveEnd },
      },
    });

    // Build blocked ranges in UTC milliseconds
    const blockedRanges: { start: number; end: number }[] = [];

    for (const interview of existingInterviews) {
      const s = new Date(interview.scheduledAt).getTime();
      const e = s + (interview.duration || 60) * 60000;
      blockedRanges.push({ start: s - bufferBefore * 60000, end: e + bufferAfter * 60000 });
    }

    for (const meeting of existingMeetings) {
      const s = new Date(meeting.scheduledAt).getTime();
      const e = s + meeting.duration * 60000;
      blockedRanges.push({ start: s - bufferBefore * 60000, end: e + bufferAfter * 60000 });
    }

    // 3. Google Calendar freebusy check
    try {
      const calendar = await getCalendarClient(recruiterId);
      const integration = await prisma.calendarIntegration.findUnique({
        where: { userId_provider: { userId: recruiterId, provider: 'google' } },
      });

      const busyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: effectiveEnd.toISOString(),
          items: [{ id: integration?.calendarId || 'primary' }],
        },
      });

      const calendars = busyResponse.data.calendars || {};
      for (const cal of Object.values(calendars)) {
        for (const busy of (cal as { busy?: { start: string; end: string }[] }).busy || []) {
          blockedRanges.push({
            start: new Date(busy.start).getTime(),
            end: new Date(busy.end).getTime(),
          });
        }
      }
    } catch (gcalError) {
      console.error('[application-slots] Google Calendar freebusy check failed:', gcalError instanceof Error ? gcalError.message : gcalError);
    }

    // Filter slots against blocked ranges
    const availableSlots = allSlots.filter(slot => {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      return !blockedRanges.some(range =>
        slotStart < range.end && slotEnd > range.start
      );
    });

    return NextResponse.json({
      slots: availableSlots,
      duration,
      recruiterId,
      timezone,
      interviewerName: recruiter ? `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() : null,
      meetingType: meetingType
        ? {
            name: meetingType.name,
            locationType: meetingType.locationType,
            locationDetails: meetingType.locationDetails,
          }
        : null,
    });
  } catch (error) {
    console.error('Failed to fetch slots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available times' },
      { status: 500 }
    );
  }
}
