'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

interface MeetingData {
  id: string;
  meetingTypeName: string;
  locationType: string;
  locationDetails: string | null;
  hostName: string;
  hostTimezone: string;
  hostUsername: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string | null;
  scheduledAt: string;
  duration: number;
  timezone: string;
  meetingLink: string | null;
  location: string | null;
  status: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  rescheduledAt: string | null;
  rescheduledFrom: string | null;
}

interface TimeSlot {
  time: string;
  label: string;
}

const LOCATION_ICONS: Record<string, typeof PhoneIcon> = {
  PHONE: PhoneIcon,
  VIDEO: VideoCameraIcon,
  GOOGLE_MEET: VideoCameraIcon,
  ZOOM: VideoCameraIcon,
  IN_PERSON: MapPinIcon,
  CUSTOM: GlobeAltIcon,
};

const LOCATION_LABELS: Record<string, string> = {
  PHONE: 'Phone Call',
  VIDEO: 'Video Meeting',
  GOOGLE_MEET: 'Google Meet',
  ZOOM: 'Zoom',
  IN_PERSON: 'In Person',
  CUSTOM: 'Custom Location',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getOffsetMinutes(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

function convertTimeLabel(
  time24: string,
  dateStr: string,
  fromTimezone: string,
  toTimezone: string
): string {
  if (fromTimezone === toTimezone) {
    const [hours, minutes] = time24.split(':').map(Number);
    const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
  const [hours, minutes] = time24.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);
  const refDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const hostOffset = getOffsetMinutes(fromTimezone, refDate);
  const utcMs = refDate.getTime() - hostOffset * 60000;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: toTimezone,
  }).format(new Date(utcMs));
}

type ViewMode = 'details' | 'cancel' | 'reschedule' | 'cancelled' | 'rescheduled';

export default function ManageMeetingPage() {
  const params = useParams();
  const token = params.token as string;

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('details');

  // Cancel state
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Reschedule state
  const [displayTimezone, setDisplayTimezone] = useState('America/Chicago');
  const [timezoneOptions, setTimezoneOptions] = useState(TIMEZONES);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Auto-detect timezone
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDisplayTimezone(detected);
      if (!TIMEZONES.find(tz => tz.value === detected)) {
        setTimezoneOptions(prev => [...prev, { value: detected, label: detected.replace(/_/g, ' ') }]);
      }
    } catch {
      // Keep default
    }
  }, []);

  // Fetch meeting data
  useEffect(() => {
    if (!token) return;
    async function fetchMeeting() {
      try {
        const res = await fetch(`/api/meet/manage/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Meeting not found');
          return;
        }
        const data = await res.json();
        setMeeting(data);
        if (data.inviteeTimezone) {
          setDisplayTimezone(data.inviteeTimezone);
        }
      } catch {
        setError('Failed to load meeting');
      } finally {
        setLoading(false);
      }
    }
    fetchMeeting();
  }, [token]);

  // Set page title
  useEffect(() => {
    if (meeting) {
      document.title = `Manage Meeting - ${meeting.meetingTypeName}`;
    }
  }, [meeting]);

  // Fetch slots when date is selected in reschedule mode
  useEffect(() => {
    if (!selectedDate || mode !== 'reschedule') return;
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const dateStr = selectedDate!.toISOString().split('T')[0];
        const res = await fetch(`/api/meet/manage/${token}/slots?date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.slots || []);
        }
      } catch {
        console.error('Failed to fetch slots');
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [selectedDate, mode, token]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/meet/manage/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason || undefined,
          cancelledBy: 'invitee',
        }),
      });
      if (res.ok) {
        setMode('cancelled');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to cancel');
      }
    } catch {
      setError('Failed to cancel meeting');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) return;
    setRescheduling(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/meet/manage/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString().split('T')[0],
          time: selectedTime,
          rescheduledBy: 'invitee',
        }),
      });
      if (res.ok) {
        setMode('rescheduled');
      } else {
        const data = await res.json();
        setRescheduleError(data.error || 'Failed to reschedule');
      }
    } catch {
      setRescheduleError('Failed to reschedule meeting');
    } finally {
      setRescheduling(false);
    }
  };

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
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error && !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-danger-100 flex items-center justify-center mx-auto">
            <XCircleIcon className="w-8 h-8 text-danger-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-4">{error}</h2>
          <p className="text-slate-500 mt-2">This link may be invalid or the meeting may have been removed.</p>
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  const scheduledDate = new Date(meeting.scheduledAt);
  const LocationIcon = LOCATION_ICONS[meeting.locationType] || GlobeAltIcon;
  const tzLabel = timezoneOptions.find(tz => tz.value === displayTimezone)?.label || displayTimezone;

  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: displayTimezone,
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZone: displayTimezone,
  });

  // Already cancelled
  if (meeting.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
            <XCircleIcon className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-6">Meeting Cancelled</h2>
          <p className="text-slate-500 mt-2">
            This meeting has already been cancelled.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Meeting:</strong> {meeting.meetingTypeName}</p>
              <p><strong>With:</strong> {meeting.hostName}</p>
              {meeting.cancelReason && <p><strong>Reason:</strong> {meeting.cancelReason}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cancelled confirmation (just cancelled)
  if (mode === 'cancelled') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-danger-100 flex items-center justify-center mx-auto">
            <XCircleIcon className="w-10 h-10 text-danger-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-6">Meeting Cancelled</h2>
          <p className="text-slate-500 mt-2">
            Your meeting with {meeting.hostName} has been cancelled. They have been notified.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Meeting:</strong> {meeting.meetingTypeName}</p>
              <p><strong>Was scheduled:</strong> {formattedDate} at {formattedTime}</p>
            </div>
          </div>
          {meeting.hostUsername && (
            <Link
              href={`/meet/${meeting.hostUsername}`}
              className="inline-flex items-center gap-2 mt-6 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Book a new meeting
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Rescheduled confirmation
  if (mode === 'rescheduled') {
    const newDateStr = selectedDate?.toISOString().split('T')[0] || '';
    const newTimeLabel = selectedTime && newDateStr
      ? convertTimeLabel(selectedTime, newDateStr, meeting.hostTimezone, displayTimezone)
      : '';
    const newDateLabel = selectedDate
      ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-10 h-10 text-success-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-6">Meeting Rescheduled!</h2>
          <p className="text-slate-500 mt-2">
            Your meeting with {meeting.hostName} has been moved. They have been notified.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left">
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Meeting:</strong> {meeting.meetingTypeName}</p>
              <p className="line-through text-slate-400"><strong>Was:</strong> {formattedDate} at {formattedTime}</p>
              <p className="text-slate-900 font-medium"><strong>New time:</strong> {newDateLabel} at {newTimeLabel} ({tzLabel})</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-6 text-white">
            <h1 className="text-xl font-bold">Manage Your Meeting</h1>
            <p className="text-purple-200 text-sm mt-1">{meeting.meetingTypeName} with {meeting.hostName}</p>
          </div>

          <div className="p-6">
            {mode === 'details' && (
              <>
                {/* Meeting Summary */}
                <div className="p-5 bg-slate-50 rounded-xl mb-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-slate-700">
                      <CalendarDaysIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <span className="font-medium">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700">
                      <ClockIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <span>{formattedTime} ({tzLabel}) &middot; {meeting.duration} min</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700">
                      <LocationIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <span>{LOCATION_LABELS[meeting.locationType] || meeting.location || 'TBD'}</span>
                    </div>
                    {meeting.meetingLink && (
                      <div className="flex items-center gap-3 text-slate-700">
                        <GlobeAltIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                        <a href={meeting.meetingLink} className="text-purple-600 hover:text-purple-700 underline" target="_blank" rel="noopener noreferrer">
                          Join meeting link
                        </a>
                      </div>
                    )}
                  </div>

                  {meeting.rescheduledFrom && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-400">
                        Rescheduled from {new Date(meeting.rescheduledFrom).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric',
                          timeZone: displayTimezone,
                        })} at {new Date(meeting.rescheduledFrom).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit',
                          timeZone: displayTimezone,
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setMode('reschedule');
                      setSelectedDate(null);
                      setSelectedTime(null);
                      setAvailableSlots([]);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 text-purple-700 font-medium rounded-xl hover:bg-purple-100 transition-colors"
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    Reschedule
                  </button>
                  <button
                    onClick={() => setMode('cancel')}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-danger-50 text-danger-700 font-medium rounded-xl hover:bg-danger-100 transition-colors"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    Cancel Meeting
                  </button>
                </div>
              </>
            )}

            {mode === 'cancel' && (
              <div>
                <button
                  onClick={() => setMode('details')}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Back
                </button>

                <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Meeting</h3>
                <p className="text-sm text-slate-500 mb-6">
                  {meeting.hostName} will be notified of the cancellation.
                </p>

                <div className="mb-4">
                  <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700 mb-1">
                    Reason (optional)
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-danger-400 transition-all resize-none"
                    placeholder="Let them know why you're cancelling..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('details')}
                    className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Keep Meeting
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 px-4 py-3 bg-danger-600 text-white font-medium rounded-xl hover:bg-danger-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Cancelling...
                      </span>
                    ) : (
                      'Confirm Cancellation'
                    )}
                  </button>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-danger-600 text-center">{error}</p>
                )}
              </div>
            )}

            {mode === 'reschedule' && (
              <div>
                <button
                  onClick={() => setMode('details')}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-4"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Back
                </button>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Pick a new time</h3>
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="w-4 h-4 text-slate-400" />
                    <select
                      value={displayTimezone}
                      onChange={(e) => setDisplayTimezone(e.target.value)}
                      className="text-sm bg-transparent border-none p-0 text-slate-600 cursor-pointer focus:outline-none focus:ring-0"
                    >
                      {timezoneOptions.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected time preview */}
                {selectedTime && selectedDate && (
                  <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-purple-600 font-medium">New time</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          {' '}at {convertTimeLabel(selectedTime, selectedDate.toISOString().split('T')[0], meeting.hostTimezone, displayTimezone)}
                          {' '}({tzLabel})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedTime(null)}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
                        >
                          Change
                        </button>
                        <button
                          onClick={handleReschedule}
                          disabled={rescheduling}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {rescheduling ? 'Confirming...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                    {rescheduleError && (
                      <p className="mt-2 text-sm text-danger-600">{rescheduleError}</p>
                    )}
                  </div>
                )}

                <div className="lg:flex gap-6">
                  {/* Calendar */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-900 text-sm">
                        {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronLeftIcon className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 py-1.5">
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
                            onClick={() => {
                              if (isAvailable) {
                                setSelectedDate(date);
                                setSelectedTime(null);
                              }
                            }}
                            disabled={!isAvailable}
                            className={`
                              w-9 h-9 rounded-lg text-sm font-medium transition-all
                              ${!isCurrentMonth ? 'text-slate-300' : ''}
                              ${isCurrentMonth && !isAvailable ? 'text-slate-300 cursor-not-allowed' : ''}
                              ${isCurrentMonth && isAvailable && !isSelected ? 'text-slate-700 hover:bg-purple-50 hover:text-purple-700' : ''}
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
                    <div className="flex-1 mt-6 lg:mt-0">
                      <h4 className="font-medium text-slate-900 text-sm mb-1">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Times shown in {tzLabel}
                      </p>

                      {loadingSlots ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-sm">
                          No available times for this date
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot.time}
                              onClick={() => setSelectedTime(slot.time)}
                              className={`
                                px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all
                                ${selectedTime === slot.time
                                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                                  : 'border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50'
                                }
                              `}
                            >
                              {convertTimeLabel(
                                slot.time,
                                selectedDate.toISOString().split('T')[0],
                                meeting.hostTimezone,
                                displayTimezone
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">
            Powered by{' '}
            <Link href="/" className="text-purple-600 hover:text-purple-700 font-medium">
              Hiring Hub
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
