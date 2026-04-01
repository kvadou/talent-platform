'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDaysIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

// STC Brand Assets
const STC_LOGO = 'https://cdn.prod.website-files.com/68484ceb4053183a87397af5/6849c92715d2914bcb05d69b_STC%20Logo%20COLOR%20CURRENT%202024.png';

type TimeSlot = {
  start: string;
  end: string;
};

type LinkInfo = {
  jobTitle: string;
  candidateName: string;
  duration: number;
  timezone: string;
  interviewerName: string;
  locationType?: string;
  locationDetails?: string;
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
];

// Floating shape component for visual flair
function FloatingShape({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <div
      className={`absolute rounded-full opacity-20 animate-float-shapes ${className}`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  // Start from today or next Monday if it's weekend
  const dayOfWeek = current.getDay();
  if (dayOfWeek === 0) current.setDate(current.getDate() + 1);
  if (dayOfWeek === 6) current.setDate(current.getDate() + 2);

  for (let i = 0; i < 7; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function formatTimeInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone
  }).format(date);
}

function formatDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone
  }).format(date);
}

function formatFullDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  }).format(date);
}

function isSameDay(date1: Date, date2: Date, timezone: string): boolean {
  const d1 = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone
  }).format(date1);
  const d2 = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone
  }).format(date2);
  return d1 === d2;
}

function getLocationIcon(locationType?: string) {
  switch (locationType) {
    case 'PHONE':
      return PhoneIcon;
    case 'GOOGLE_MEET':
    case 'ZOOM':
      return VideoCameraIcon;
    case 'IN_PERSON':
      return MapPinIcon;
    default:
      return VideoCameraIcon;
  }
}

function getLocationLabel(locationType?: string) {
  switch (locationType) {
    case 'PHONE':
      return 'Phone Call';
    case 'GOOGLE_MEET':
      return 'Google Meet';
    case 'ZOOM':
      return 'Zoom Meeting';
    case 'IN_PERSON':
      return 'In Person';
    default:
      return 'Video Interview';
  }
}

export default function SchedulePage() {
  const params = useParams();
  const token = params.token as string;

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Detect user's timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TIMEZONES.find(tz => tz.value === detected)) {
        setTimezone(detected);
      }
    } catch {
      // Keep default
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch link info
        const infoRes = await fetch(`/api/scheduling-links/${token}/info`);
        if (infoRes.ok) {
          const info = await infoRes.json();
          setLinkInfo(info);
        }

        // Fetch slots for next 30 days
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const slotsRes = await fetch(
          `/api/scheduling-links/${token}/slots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!slotsRes.ok) {
          const data = await slotsRes.json();
          throw new Error(data.error || 'Failed to load available times');
        }

        const data = await slotsRes.json();
        setSlots(data.slots || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scheduling page');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const slotsByDay = useMemo(() => {
    const grouped: Record<string, TimeSlot[]> = {};

    weekDays.forEach(day => {
      const key = day.toISOString().split('T')[0];
      grouped[key] = slots.filter(slot =>
        isSameDay(new Date(slot.start), day, timezone)
      ).sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    });

    return grouped;
  }, [slots, weekDays, timezone]);

  const handleBook = async () => {
    if (!selectedSlot) return;

    setBooking(true);
    setError(null);

    try {
      const res = await fetch(`/api/scheduling-links/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: selectedSlot.start,
          endTime: selectedSlot.end
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to book interview');
      }

      setBooked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book interview');
    } finally {
      setBooking(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));

      // Don't go before today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (newDate < today) return today;

      return newDate;
    });
  };

  const canGoPrev = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return weekStart > today;
  }, [weekStart]);

  const LocationIcon = getLocationIcon(linkInfo?.locationType);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3BA9DA] via-[#2D8FBA] to-[#7C3AED] flex items-center justify-center relative overflow-hidden">
        <FloatingShape className="w-32 h-32 bg-white top-20 left-10" delay={0} />
        <FloatingShape className="w-24 h-24 bg-[#F5D547] bottom-40 right-20" delay={1} />
        <FloatingShape className="w-40 h-40 bg-[#E8837B] bottom-32 left-1/4" delay={2} />

        <div className="text-center relative z-10">
          <Image src={STC_LOGO} alt="Acme Talent" width={320} height={90} unoptimized className="h-20 w-auto mx-auto mb-8" />
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white/90 text-lg font-medium">Loading available times...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !selectedSlot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3BA9DA] via-[#2D8FBA] to-[#7C3AED] flex items-center justify-center p-4 relative overflow-hidden">
        <FloatingShape className="w-32 h-32 bg-white top-20 left-10" delay={0} />
        <FloatingShape className="w-24 h-24 bg-[#F5D547] bottom-40 right-20" delay={1} />

        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center relative z-10">
          <Image src={STC_LOGO} alt="Acme Talent" width={250} height={70} unoptimized className="h-14 w-auto mx-auto mb-8" />
          <div className="w-20 h-20 bg-[#E8837B]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ExclamationTriangleIcon className="w-10 h-10 text-[#E8837B]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D3E6F] mb-3">Unable to Load Scheduling</h1>
          <p className="text-gray-600">{error}</p>
          <a
            href="mailto:recruiting@acmetalent.com"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#3BA9DA] text-white font-semibold rounded-full hover:bg-[#2D8FBA] transition-colors"
          >
            Contact Support
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  // Success/Booked state
  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3BA9DA] via-[#2D8FBA] to-[#7C3AED] flex items-center justify-center p-4 relative overflow-hidden">
        <FloatingShape className="w-32 h-32 bg-white top-20 left-10" delay={0} />
        <FloatingShape className="w-24 h-24 bg-[#F5D547] top-32 right-20" delay={1} />
        <FloatingShape className="w-40 h-40 bg-[#E8837B] bottom-32 left-1/4" delay={2} />
        <FloatingShape className="w-16 h-16 bg-white bottom-40 right-1/3" delay={0.5} />

        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full text-center relative z-10">
          <Image src={STC_LOGO} alt="Acme Talent" width={250} height={70} unoptimized className="h-14 w-auto mx-auto mb-8" />

          {/* Success Icon with Animation */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-success-100 rounded-full animate-ping opacity-25" />
            <div className="relative w-24 h-24 bg-success-100 rounded-full flex items-center justify-center">
              <CheckCircleSolidIcon className="w-14 h-14 text-success-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-[#2D3E6F] mb-3">You&apos;re All Set!</h1>
          <p className="text-gray-600 mb-8">
            Your interview has been scheduled. You&apos;ll receive a calendar invitation shortly.
          </p>

          {selectedSlot && (
            <div className="bg-gradient-to-r from-[#3BA9DA]/10 to-[#7C3AED]/10 rounded-2xl p-6 mb-8 text-left">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                  <CalendarDaysIcon className="w-7 h-7 text-[#3BA9DA]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#7C3AED] uppercase tracking-wide mb-1">
                    Interview Scheduled
                  </p>
                  <p className="text-xl font-bold text-[#2D3E6F]">
                    {formatFullDateInZone(new Date(selectedSlot.start), timezone)}
                  </p>
                  <p className="text-lg text-gray-700 mt-1">
                    {formatTimeInZone(new Date(selectedSlot.start), timezone)} - {formatTimeInZone(new Date(selectedSlot.end), timezone)}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                    <GlobeAltIcon className="w-4 h-4" />
                    {TIMEZONES.find(tz => tz.value === timezone)?.label || timezone}
                  </div>
                </div>
              </div>

              {linkInfo && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center">
                      <LocationIcon className="w-5 h-5 text-[#7C3AED]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Meeting Type</p>
                      <p className="font-semibold text-[#2D3E6F]">{getLocationLabel(linkInfo.locationType)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Need to make changes? Check your email for rescheduling options.
            </p>
            <a
              href="mailto:recruiting@acmetalent.com"
              className="text-[#3BA9DA] hover:text-[#2D8FBA] text-sm font-medium transition-colors"
            >
              Contact us if you have questions
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3BA9DA] via-[#2D8FBA] to-[#7C3AED]" />

        {/* Animated Shapes */}
        <FloatingShape className="w-24 h-24 bg-white top-10 left-10" delay={0} />
        <FloatingShape className="w-20 h-20 bg-[#F5D547] top-20 right-20" delay={1} />
        <FloatingShape className="w-32 h-32 bg-[#E8837B] bottom-0 left-1/4" delay={2} />
        <FloatingShape className="w-16 h-16 bg-white bottom-10 right-1/3" delay={0.5} />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
          {/* Logo */}
          <div className="mb-8">
            <Link href="https://acmetalent.com">
              <Image
                src={STC_LOGO}
                alt="Acme Talent"
                width={250}
                height={70}
                unoptimized
                className="h-14 object-contain hover:scale-105 transition-transform duration-300"
              />
            </Link>
          </div>

          {/* Header Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <CalendarDaysIcon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  Schedule Your Interview
                </h1>
                {linkInfo && (
                  <>
                    <p className="text-white/80 text-lg">{linkInfo.jobTitle}</p>
                    {linkInfo.candidateName && (
                      <p className="text-white/60 text-sm mt-1">
                        Hi {linkInfo.candidateName.split(' ')[0]}! Pick a time that works for you.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Meeting Info Pills */}
            {linkInfo && (
              <div className="flex flex-wrap gap-3 mt-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white text-sm">
                  <ClockIcon className="w-4 h-4" />
                  {linkInfo.duration} minutes
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white text-sm">
                  <LocationIcon className="w-4 h-4" />
                  {getLocationLabel(linkInfo.locationType)}
                </div>
                {linkInfo.interviewerName && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white text-sm">
                    <UserIcon className="w-4 h-4" />
                    with {linkInfo.interviewerName}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10 -mt-6">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Timezone selector */}
              <div className="flex items-center gap-3">
                <GlobeAltIcon className="w-5 h-5 text-gray-400" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#3BA9DA] focus:border-transparent transition-all"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* Week navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateWeek('prev')}
                  disabled={!canGoPrev}
                  className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-[#2D3E6F] min-w-[160px] text-center">
                  {formatDateInZone(weekDays[0], timezone)} - {formatDateInZone(weekDays[6], timezone)}
                </span>
                <button
                  onClick={() => navigateWeek('next')}
                  className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors"
                >
                  <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Selected slot confirmation */}
          {selectedSlot && (
            <div className="mx-6 mt-6 bg-gradient-to-r from-[#3BA9DA]/10 to-[#7C3AED]/10 border border-[#3BA9DA]/20 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-[#3BA9DA]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#7C3AED]">Selected Time</p>
                    <p className="text-lg font-bold text-[#2D3E6F]">
                      {formatDateInZone(new Date(selectedSlot.start), timezone)} at {formatTimeInZone(new Date(selectedSlot.start), timezone)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleBook}
                    disabled={booking}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#3BA9DA] to-[#7C3AED] rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
                  >
                    {booking ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Confirming...
                      </span>
                    ) : (
                      'Confirm Interview'
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 text-sm text-danger-600 bg-danger-50 px-4 py-2 rounded-lg">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Calendar Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {weekDays.map(day => {
                const key = day.toISOString().split('T')[0];
                const daySlots = slotsByDay[key] || [];
                const isToday = isSameDay(day, new Date(), timezone);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(day);
                const dayNum = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: timezone }).format(day);

                return (
                  <div
                    key={key}
                    className={`rounded-2xl border-2 transition-all ${
                      isWeekend
                        ? 'bg-gray-50 border-gray-100'
                        : isToday
                          ? 'bg-[#3BA9DA]/5 border-[#3BA9DA]/30'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {/* Day Header */}
                    <div className={`px-3 py-3 text-center border-b ${isToday ? 'border-[#3BA9DA]/20' : 'border-gray-100'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${
                        isToday ? 'text-[#3BA9DA]' : 'text-gray-400'
                      }`}>
                        {dayOfWeek}
                      </p>
                      <p className={`text-2xl font-bold mt-1 ${
                        isToday ? 'text-[#3BA9DA]' : 'text-[#2D3E6F]'
                      }`}>
                        {dayNum}
                      </p>
                      {isToday && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-[#3BA9DA] text-white text-[10px] font-bold rounded-full uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Time Slots */}
                    <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, idx) => {
                          const isSelected = selectedSlot?.start === slot.start;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedSlot(slot)}
                              className={`w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-r from-[#3BA9DA] to-[#7C3AED] text-white shadow-md'
                                  : 'text-[#2D3E6F] hover:bg-[#3BA9DA]/10 hover:text-[#3BA9DA] border border-transparent hover:border-[#3BA9DA]/20'
                              }`}
                            >
                              {formatTimeInZone(new Date(slot.start), timezone)}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4 px-2">
                          {isWeekend ? 'Weekend' : 'No availability'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* No slots message */}
            {slots.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CalendarDaysIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-[#2D3E6F] mb-2">No Available Times</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  There are no available time slots at the moment. Please check back later or contact us directly.
                </p>
                <a
                  href="mailto:recruiting@acmetalent.com"
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#3BA9DA] text-white font-semibold rounded-full hover:bg-[#2D8FBA] transition-colors"
                >
                  Contact Us
                  <ArrowRightIcon className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1E2A4A] text-white py-12 px-6 mt-8">
        <div className="max-w-4xl mx-auto text-center">
          <Image src={STC_LOGO} alt="Acme Talent" width={220} height={60} unoptimized className="h-12 w-auto mx-auto mb-6" />
          <p className="text-white/80 mb-2">
            Questions about scheduling?
          </p>
          <a
            href="mailto:recruiting@acmetalent.com"
            className="text-[#F5D547] hover:text-white font-semibold transition-colors"
          >
            recruiting@acmetalent.com
          </a>
          <div className="border-t border-white/10 mt-8 pt-8 text-sm text-white/50">
            © {new Date().getFullYear()} Acme Talent. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
