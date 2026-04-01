'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { AlertModal } from '@/components/ui/AlertModal';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

interface MeetingTypeData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: number;
  color: string;
  locationType: 'PHONE' | 'VIDEO' | 'GOOGLE_MEET' | 'ZOOM' | 'IN_PERSON' | 'CUSTOM';
  locationDetails: string | null;
  googleMeetEnabled: boolean;
  zoomEnabled: boolean;
  minNoticeHours: number;
  maxDaysOut: number;
  slotIncrement: number;
  bufferBefore: number;
  bufferAfter: number;
}

interface UserData {
  firstName: string;
  lastName: string;
  timezone: string | null;
  profileImageUrl: string | null;
  organizationName: string | null;
}

const BRAND_LOGO_URL = 'https://placehold.co/200x60/3BA9DA/white?text=Acme+Talent';

interface TimeSlot {
  time: string;
  label: string;
}

interface PageProps {
  params: {
    username: string;
    meetingSlug: string;
  };
}

const LOCATION_ICONS: Record<string, typeof PhoneIcon> = {
  PHONE: PhoneIcon,
  VIDEO: VideoCameraIcon,
  GOOGLE_MEET: VideoCameraIcon,
  ZOOM: VideoCameraIcon,
  IN_PERSON: MapPinIcon,
  CUSTOM: GlobeAltIcon,
};

function formatTime12h(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Convert a time string (HH:mm) on a given date from one timezone to another,
 * returning a 12-hour formatted label.
 */
function convertTimeLabel(
  time24: string,
  dateStr: string,
  fromTimezone: string,
  toTimezone: string
): string {
  if (fromTimezone === toTimezone) {
    return formatTime12h(time24);
  }
  const [hours, minutes] = time24.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);
  const refDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const hostOffset = getOffsetMinutes(fromTimezone, refDate);
  const utcMs = refDate.getTime() - hostOffset * 60000;
  const utcDate = new Date(utcMs);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: toTimezone,
  }).format(utcDate);
}

function getOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

const LOCATION_LABELS: Record<string, string> = {
  PHONE: 'Phone Call',
  VIDEO: 'Video Meeting',
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  IN_PERSON: 'In Person',
  CUSTOM: 'Custom Location',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function BookMeetingPage({ params }: PageProps) {
  const { username, meetingSlug } = params;
  const router = useRouter();

  const [meetingType, setMeetingType] = useState<MeetingTypeData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking form state
  const [step, setStep] = useState<'calendar' | 'details' | 'confirmed'>('calendar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(null);

  // Timezone state
  const [inviteeTimezone, setInviteeTimezone] = useState<string>('America/Chicago');
  const [timezoneOptions, setTimezoneOptions] = useState(TIMEZONES);

  // Fetch meeting type data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/meet/${username}/${meetingSlug}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Meeting type not found');
          } else {
            setError('Failed to load meeting type');
          }
          return;
        }
        const data = await res.json();
        setMeetingType(data.meetingType);
        setUserData(data.user);
      } catch (err) {
        setError('Failed to load meeting type');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [username, meetingSlug]);

  // Set page title
  useEffect(() => {
    if (userData && meetingType) {
      document.title = `${meetingType.name} - ${userData.firstName} ${userData.lastName}`;
    }
  }, [userData, meetingType]);

  // Auto-detect invitee timezone
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setInviteeTimezone(detected);
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

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!selectedDate || !meetingType) return;

    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const dateStr = selectedDate!.toISOString().split('T')[0];
        const res = await fetch(
          `/api/meet/${username}/${meetingSlug}/slots?date=${dateStr}`
        );
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.slots || []);
        }
      } catch (err) {
        console.error('Failed to fetch slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [selectedDate, meetingType, username, meetingSlug]);

  // Generate calendar days
  const getCalendarDays = () => {
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
  };

  const isDateAvailable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return false;

    if (meetingType) {
      const minNotice = new Date();
      minNotice.setHours(minNotice.getHours() + meetingType.minNoticeHours);
      if (date < minNotice) return false;

      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + meetingType.maxDaysOut);
      if (date > maxDate) return false;
    }

    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !name || !email) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/meet/${username}/${meetingSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString().split('T')[0],
          time: selectedTime,
          name,
          email,
          notes,
          inviteeTimezone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.manageToken) {
          setManageToken(data.manageToken);
        }
        setStep('confirmed');
      } else {
        const data = await res.json();
        setAlertMsg(data.error || 'Failed to book meeting');
      }
    } catch (err) {
      setAlertMsg('Failed to book meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const tzLabel = timezoneOptions.find(tz => tz.value === inviteeTimezone)?.label || inviteeTimezone;
  const hostTz = userData?.timezone || 'America/Chicago';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !meetingType || !userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto">
            <CalendarDaysIcon className="w-8 h-8 text-danger-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-4">{error || 'Not Found'}</h2>
          <p className="text-slate-500 mt-2">This meeting link may be invalid or expired.</p>
          <Link
            href={`/meet/${username}`}
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium mt-4"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to all meeting types
          </Link>
        </div>
      </div>
    );
  }

  const LocationIcon = LOCATION_ICONS[meetingType.locationType] || GlobeAltIcon;

  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-10 h-10 text-success-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-5">Meeting Confirmed!</h2>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">
              Your meeting with {userData.firstName} has been scheduled.
            </p>
            <div className="mt-5 p-4 bg-slate-50 rounded-xl text-left">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <CalendarDaysIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span>{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600">
                  <ClockIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span>
                    {selectedTime && selectedDate
                      ? convertTimeLabel(selectedTime, selectedDate.toISOString().split('T')[0], hostTz, inviteeTimezone)
                      : ''} ({tzLabel})
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600">
                  <LocationIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span>{LOCATION_LABELS[meetingType.locationType]}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-5">
              A confirmation email has been sent to <strong>{email}</strong>
            </p>
            {manageToken && (
              <Link
                href={`/meet/manage/${manageToken}`}
                className="inline-flex items-center gap-2 mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Reschedule or cancel this meeting
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-4 sm:py-8">
        {/* Back Link */}
        <Link
          href={`/meet/${username}`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4 sm:mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to meeting types
        </Link>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="lg:flex">
            {/* Left Sidebar - Meeting Info */}
            <div className="lg:w-72 xl:w-80 flex-shrink-0 p-5 sm:p-6 lg:p-7 border-b lg:border-b-0 lg:border-r border-slate-100">
              {/* Mobile: Compact horizontal layout / Desktop: Vertical layout */}
              <div className="flex items-start gap-4 lg:block">
                {/* Logo + Avatar stacked on desktop, side by side context on mobile */}
                <div className="flex-shrink-0 lg:mb-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BRAND_LOGO_URL} alt="Acme Talent" className="h-6 sm:h-7 lg:h-8 mb-3 lg:mb-5" />

                  <div className="flex items-center gap-3 lg:mb-5">
                    {userData.profileImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={userData.profileImageUrl}
                        alt={`${userData.firstName} ${userData.lastName}`}
                        className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                        <span className="text-sm lg:text-lg font-bold text-white">
                          {userData.firstName[0]}{userData.lastName[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm lg:text-base">
                        {userData.firstName} {userData.lastName}
                      </h3>
                      {userData.organizationName && (
                        <p className="text-xs lg:text-sm text-slate-500">{userData.organizationName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meeting details */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 lg:mb-1">{meetingType.name}</h1>
                  {meetingType.description && (
                    <p className="text-slate-500 text-sm mt-0.5 lg:mt-1 line-clamp-2 lg:line-clamp-none">{meetingType.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 lg:mt-5 lg:flex-col lg:items-start lg:gap-y-2.5 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
                      <span>{meetingType.duration} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <LocationIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
                      <span>{LOCATION_LABELS[meetingType.locationType]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GlobeAltIcon className="w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
                      <select
                        value={inviteeTimezone}
                        onChange={(e) => setInviteeTimezone(e.target.value)}
                        className="text-sm bg-transparent border-none p-0 text-slate-600 cursor-pointer focus:outline-none focus:ring-0 max-w-[180px] truncate"
                      >
                        {timezoneOptions.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 p-5 sm:p-6 lg:p-7">
              {step === 'calendar' ? (
                <>
                  {/* Calendar + Slots: stacked on mobile, side by side on large */}
                  <div className="lg:flex gap-6 xl:gap-8">
                    {/* Calendar */}
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
                        {getCalendarDays().map((date, i) => {
                          const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                          const isAvailable = isDateAvailable(date);
                          const isSelected = selectedDate?.toDateString() === date.toDateString();
                          const isToday = date.toDateString() === new Date().toDateString();

                          return (
                            <button
                              key={i}
                              onClick={() => isAvailable && setSelectedDate(date)}
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

                    {/* Time Slots */}
                    {selectedDate && (
                      <div className="flex-1 mt-6 lg:mt-0 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm sm:text-base mb-0.5">
                          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        <p className="text-xs text-slate-400 mb-3 sm:mb-4">
                          Times shown in {tzLabel}
                        </p>

                        {loadingSlots ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="text-center py-10 text-sm text-slate-500">
                            No available times for this date
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 max-h-[320px] overflow-y-auto pr-1">
                            {availableSlots.map((slot) => (
                              <button
                                key={slot.time}
                                onClick={() => {
                                  setSelectedTime(slot.time);
                                  setStep('details');
                                }}
                                className="px-2 sm:px-3 py-2.5 sm:py-3 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50 active:bg-purple-100"
                              >
                                {convertTimeLabel(slot.time, selectedDate.toISOString().split('T')[0], hostTz, inviteeTimezone)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Details Form */
                <div>
                  <button
                    onClick={() => setStep('calendar')}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4 sm:mb-5"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Change time
                  </button>

                  <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl mb-5 sm:mb-6">
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <CalendarDaysIcon className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <span className="font-medium">
                        {selectedDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                        {' '}at {selectedTime && selectedDate
                          ? convertTimeLabel(selectedTime, selectedDate.toISOString().split('T')[0], hostTz, inviteeTimezone)
                          : ''} ({tzLabel})
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Enter your details</h3>

                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                        Your name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                        placeholder="John Doe"
                        required
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Email address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                        placeholder="john@example.com"
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                        Additional notes
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all resize-none"
                        placeholder="Anything you'd like to share before the meeting..."
                      />
                    </div>

                    <button
                      onClick={handleBooking}
                      disabled={!name || !email || submitting}
                      className="w-full px-6 py-3 sm:py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-purple-200 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Scheduling...
                        </span>
                      ) : (
                        'Schedule Meeting'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 sm:py-8">
          <p className="text-xs text-slate-300">
            Powered by{' '}
            <Link href="/" className="text-slate-400 hover:text-purple-600 font-medium transition-colors">
              Hiring Hub
            </Link>
          </p>
        </div>

        <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Error" message={alertMsg || ""} />
      </div>
    </div>
  );
}
