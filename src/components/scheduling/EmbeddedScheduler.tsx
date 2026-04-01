'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  GlobeAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

type TimeSlot = {
  start: string;
  end: string;
};

type SchedulerProps = {
  /** Application token for fetching slots and booking */
  applicationToken: string;
  /** Whether to show as a modal */
  isModal?: boolean;
  /** Whether modal is open (required if isModal=true) */
  isOpen?: boolean;
  /** Close modal callback */
  onClose?: () => void;
  /** Called when interview is successfully booked */
  onBooked?: (slot: TimeSlot) => void;
  /** Job title to display */
  jobTitle?: string;
  /** Meeting duration in minutes */
  duration?: number;
  /** Interviewer name */
  interviewerName?: string;
  /** Meeting type (PHONE, GOOGLE_MEET, ZOOM, IN_PERSON) */
  locationType?: string;
  /** Interview ID for rescheduling (if provided, uses reschedule mode) */
  interviewId?: string;
  /** Current scheduled time (shown when rescheduling) */
  currentScheduledTime?: string;
  /** Stage name to use in title (e.g. "Phone Screen" instead of "Interview") */
  stageName?: string;
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTimeInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(date);
}

function formatFullDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
}

function formatShortDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(date);
}

function isSameDay(date1: Date, date2: Date, timezone: string): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  return fmt.format(date1) === fmt.format(date2);
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

function SchedulerContent({
  applicationToken,
  onBooked,
  jobTitle,
  duration = 30,
  interviewerName,
  locationType,
  onClose,
  showCloseButton = false,
  interviewId,
  currentScheduledTime,
  stageName,
}: SchedulerProps & { showCloseButton?: boolean }) {
  const isReschedule = !!interviewId;
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [timezoneOptions, setTimezoneOptions] = useState(TIMEZONES);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Detect user's timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detected);
      if (!TIMEZONES.find(tz => tz.value === detected)) {
        setTimezoneOptions(prev => [
          ...prev,
          { value: detected, label: detected.replace(/_/g, ' ') },
        ]);
      }
    } catch {
      // Keep default
    }
  }, []);

  // Actual values from API (overrides props if returned)
  const [apiDuration, setApiDuration] = useState<number | null>(null);
  const [apiLocationType, setApiLocationType] = useState<string | null>(null);
  const [apiInterviewerName, setApiInterviewerName] = useState<string | null>(null);

  // Fetch all slots upfront (30 days)
  useEffect(() => {
    if (!applicationToken) return;

    async function fetchSlots() {
      setLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const res = await fetch(
          `/api/public/applications/${applicationToken}/slots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load available times');
        }

        const data = await res.json();
        setSlots(data.slots || []);

        // Use meeting type info from API if available
        if (data.duration) setApiDuration(data.duration);
        if (data.meetingType?.locationType) setApiLocationType(data.meetingType.locationType);
        if (data.interviewerName) setApiInterviewerName(data.interviewerName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scheduling page');
      } finally {
        setLoading(false);
      }
    }

    fetchSlots();
  }, [applicationToken]);

  // Get dates that have available slots (for highlighting on calendar)
  const datesWithSlots = useMemo(() => {
    const dateSet = new Set<string>();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    for (const slot of slots) {
      dateSet.add(fmt.format(new Date(slot.start)));
    }
    return dateSet;
  }, [slots, timezone]);

  // Get slots for the selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return slots
      .filter(slot => isSameDay(new Date(slot.start), selectedDate, timezone))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [slots, selectedDate, timezone]);

  // Generate calendar grid for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);
    while (current <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const isDateAvailable = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;

    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
    return datesWithSlots.has(dateStr);
  }, [datesWithSlots, timezone]);

  const handleBook = useCallback(async () => {
    if (!selectedSlot) return;

    setBooking(true);
    setError(null);

    try {
      const endpoint = isReschedule
        ? `/api/public/applications/${applicationToken}/reschedule`
        : `/api/public/applications/${applicationToken}/book`;

      const bodyData = isReschedule
        ? { interviewId, startTime: selectedSlot.start, endTime: selectedSlot.end }
        : { startTime: selectedSlot.start, endTime: selectedSlot.end };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || (isReschedule ? 'Failed to reschedule interview' : 'Failed to book interview'));
      }

      setBooked(true);
      onBooked?.(selectedSlot);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isReschedule ? 'Failed to reschedule interview' : 'Failed to book interview'));
    } finally {
      setBooking(false);
    }
  }, [selectedSlot, applicationToken, onBooked, isReschedule, interviewId]);

  // Prefer explicit prop values (caller knows the context), fall back to API
  const effectiveDuration = apiDuration || duration;
  const effectiveLocationType = locationType || apiLocationType || undefined;
  const effectiveInterviewerName = interviewerName || apiInterviewerName || undefined;

  const LocationIcon = getLocationIcon(effectiveLocationType);
  const tzLabel = timezoneOptions.find(tz => tz.value === timezone)?.label || timezone;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-sm">Loading available times...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !selectedSlot) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-danger-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-7 h-7 text-danger-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Unable to Load Times</h3>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (booked) {
    return (
      <div className="py-12 px-6">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 bg-success-100 rounded-full animate-ping opacity-25" />
            <div className="relative w-16 h-16 bg-success-100 rounded-full flex items-center justify-center">
              <CheckCircleSolidIcon className="w-10 h-10 text-success-600" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {isReschedule
              ? `${stageName || 'Interview'} Rescheduled!`
              : `${stageName || 'Interview'} Scheduled!`}
          </h3>
          <p className="text-slate-500 mb-6">
            {isReschedule ? "Your interview has been rescheduled. You'll receive an updated calendar invitation." : "You'll receive a calendar invitation shortly."}
          </p>

          {selectedSlot && (
            <div className="bg-slate-50 rounded-xl p-5 text-left max-w-sm mx-auto">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <CalendarDaysIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium">{formatFullDateInZone(new Date(selectedSlot.start), timezone)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600">
                  <ClockIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span>
                    {formatTimeInZone(new Date(selectedSlot.start), timezone)} – {formatTimeInZone(new Date(selectedSlot.end), timezone)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600">
                  <GlobeAltIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span>{tzLabel}</span>
                </div>
              </div>
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <CalendarDaysIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {isReschedule
                  ? `Reschedule Your ${stageName || 'Interview'}`
                  : `Schedule Your ${stageName || 'Interview'}`}
              </h3>
              {jobTitle && <p className="text-sm text-slate-500">{jobTitle}</p>}
            </div>
          </div>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {isReschedule && currentScheduledTime && (
          <p className="text-xs text-danger-500 mt-2 ml-[52px]">
            Currently scheduled: {formatFullDateInZone(new Date(currentScheduledTime), timezone)} at {formatTimeInZone(new Date(currentScheduledTime), timezone)}
          </p>
        )}
      </div>

      {/* Main content: sidebar info + calendar/slots */}
      <div className="lg:flex">
        {/* Left sidebar - Meeting info */}
        <div className="lg:w-56 xl:w-64 flex-shrink-0 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:flex-col lg:items-start lg:gap-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
              <span>{effectiveDuration} min</span>
            </div>
            <div className="flex items-center gap-2">
              <LocationIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
              <span>{getLocationLabel(effectiveLocationType)}</span>
            </div>
            {effectiveInterviewerName && (
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
                <span>with {effectiveInterviewerName}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="text-sm bg-transparent border-none p-0 text-slate-600 cursor-pointer focus:outline-none focus:ring-0 max-w-[180px] truncate"
              >
                {timezoneOptions.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right content - Calendar + Time Slots */}
        <div className="flex-1 p-5 sm:p-6">
          {slots.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CalendarDaysIcon className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Available Times</h3>
              <p className="text-slate-500 text-sm">Please check back later or contact us directly.</p>
            </div>
          ) : (
            <div className="lg:flex gap-6 xl:gap-8">
              {/* Month Calendar */}
              <div className="flex-shrink-0 lg:w-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                      className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors"
                    >
                      <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
                    </button>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                      className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors"
                    >
                      <ChevronRightIcon className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                  {DAYS.map((day) => (
                    <div key={day} className="text-center text-xs sm:text-sm font-medium text-slate-400 py-1.5 sm:py-2">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((date, i) => {
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const isAvailable = isDateAvailable(date);
                    const isSelected = selectedDate?.toDateString() === date.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();

                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (isAvailable) {
                            setSelectedDate(date);
                            setSelectedSlot(null);
                          }
                        }}
                        disabled={!isAvailable}
                        className={`
                          aspect-square w-full max-w-[44px] mx-auto rounded-lg text-sm font-medium transition-all
                          ${!isCurrentMonth ? 'text-slate-200' : ''}
                          ${isCurrentMonth && !isAvailable ? 'text-slate-300 cursor-not-allowed' : ''}
                          ${isCurrentMonth && isAvailable && !isSelected ? 'text-slate-700 hover:bg-purple-50 hover:text-purple-700 active:bg-purple-100' : ''}
                          ${isSelected ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : ''}
                          ${isToday && !isSelected ? 'ring-2 ring-purple-200' : ''}
                        `}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots for selected day */}
              {selectedDate && (
                <div className="flex-1 mt-6 lg:mt-0 min-w-0">
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base mb-0.5">
                    {formatShortDateInZone(selectedDate, timezone)}
                  </h3>
                  <p className="text-xs text-slate-400 mb-3 sm:mb-4">
                    Times shown in {tzLabel}
                  </p>

                  {slotsForSelectedDate.length === 0 ? (
                    <div className="text-center py-10 text-sm text-slate-500">
                      No available times for this date
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                      {slotsForSelectedDate.map((slot, idx) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        const timeLabel = formatTimeInZone(new Date(slot.start), timezone);

                        return isSelected ? (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1 px-4 py-3 rounded-lg border-2 border-purple-600 bg-purple-50 text-sm font-semibold text-purple-700 text-center">
                              {timeLabel}
                            </div>
                            <button
                              onClick={handleBook}
                              disabled={booking}
                              className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-md shadow-purple-200"
                            >
                              {booking ? 'Confirming...' : 'Confirm'}
                            </button>
                          </div>
                        ) : (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setError(null);
                            }}
                            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 text-sm font-medium text-slate-700 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-100 transition-all text-center"
                          >
                            {timeLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {error && selectedSlot && (
                    <p className="mt-3 text-sm text-danger-600 flex items-center gap-2">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      {error}
                    </p>
                  )}
                </div>
              )}

              {/* Prompt to select a date if none selected */}
              {!selectedDate && (
                <div className="flex-1 mt-6 lg:mt-0 flex items-center justify-center min-h-[200px]">
                  <div className="text-center">
                    <CalendarDaysIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Select a date to view available times</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmbeddedScheduler(props: SchedulerProps) {
  const { isModal, isOpen, onClose, ...contentProps } = props;

  // Inline/embedded mode
  if (!isModal) {
    return (
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <SchedulerContent {...contentProps} onClose={onClose} />
      </div>
    );
  }

  // Modal mode
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose || (() => {})}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                <SchedulerContent {...contentProps} onClose={onClose} showCloseButton />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default EmbeddedScheduler;
