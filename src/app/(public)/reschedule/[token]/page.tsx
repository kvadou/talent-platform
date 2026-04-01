'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

type TimeSlot = {
  start: string;
  end: string;
};

type InterviewInfo = {
  id: string;
  scheduledAt: string;
  duration: number;
  jobTitle: string;
  candidateName: string;
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone
  }).format(date);
}

function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const dayOfWeek = current.getDay();
  if (dayOfWeek === 0) current.setDate(current.getDate() + 1);
  if (dayOfWeek === 6) current.setDate(current.getDate() + 2);

  for (let i = 0; i < 7; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
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

export default function ReschedulePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const interviewId = searchParams.get('interviewId');

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewInfo | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduled, setRescheduled] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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
          setInterview({
            id: interviewId || '',
            scheduledAt: new Date().toISOString(),
            duration: info.duration,
            jobTitle: info.jobTitle,
            candidateName: info.candidateName
          });
        }

        // Fetch slots
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
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token, interviewId]);

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

  const handleReschedule = async () => {
    if (!selectedSlot || !interviewId) return;

    setRescheduling(true);
    setError(null);

    try {
      const res = await fetch(`/api/scheduling-links/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          rescheduleInterviewId: interviewId
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reschedule');
      }

      setRescheduled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancel = async () => {
    if (!interviewId) return;

    setRescheduling(true);
    try {
      // Note: This would need an authenticated endpoint for actual cancellation
      setCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setRescheduling(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-warning-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Interview Cancelled</h1>
          <p className="text-gray-600 mb-4">
            Your interview has been cancelled. Our team will be in touch if needed.
          </p>
        </div>
      </div>
    );
  }

  if (rescheduled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Rescheduled!</h1>
          <p className="text-gray-600 mb-6">
            Your interview has been rescheduled. You&apos;ll receive an updated calendar invitation shortly.
          </p>
          {selectedSlot && (
            <div className="bg-warning-50 rounded-xl p-4">
              <p className="text-sm text-warning-600 font-medium mb-1">
                {formatDateInZone(new Date(selectedSlot.start), timezone)}
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {formatTimeInZone(new Date(selectedSlot.start), timezone)} - {formatTimeInZone(new Date(selectedSlot.end), timezone)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Reschedule Your Interview</h1>
                {interview && (
                  <p className="text-warning-200">{interview.jobTitle}</p>
                )}
              </div>
            </div>
            <p className="text-warning-100 text-sm">
              Need to change your interview time? Select a new slot below.
            </p>
          </div>

          <div className="p-6">
            {/* Cancel option */}
            {!showCancelConfirm ? (
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-sm text-danger-600 hover:text-danger-700"
                >
                  Cancel interview instead
                </button>
              </div>
            ) : (
              <div className="mb-6 bg-danger-50 border border-danger-200 rounded-xl p-4">
                <p className="text-sm text-danger-800 mb-3">
                  Are you sure you want to cancel this interview?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-white bg-danger-600 rounded-lg hover:bg-danger-700"
                  >
                    Yes, Cancel
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    No, Keep It
                  </button>
                </div>
              </div>
            )}

            {/* Timezone */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateWeek('prev')}
                  disabled={!canGoPrev}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Selected slot */}
            {selectedSlot && (
              <div className="mb-6 bg-warning-50 border border-warning-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-warning-600 font-medium">New time</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDateInZone(new Date(selectedSlot.start), timezone)} at {formatTimeInZone(new Date(selectedSlot.start), timezone)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSlot(null)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
                    >
                      Change
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={rescheduling}
                      className="px-6 py-2 text-sm font-medium text-white bg-warning-600 rounded-lg hover:bg-warning-700 disabled:opacity-50"
                    >
                      {rescheduling ? 'Confirming...' : 'Confirm New Time'}
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-danger-600">{error}</p>
                )}
              </div>
            )}

            {/* Time slots grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {weekDays.map(day => {
                const key = day.toISOString().split('T')[0];
                const daySlots = slotsByDay[key] || [];
                const isToday = isSameDay(day, new Date(), timezone);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div key={key} className={`rounded-xl border ${isWeekend ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
                    <div className={`px-3 py-2 text-center border-b ${isToday ? 'bg-warning-50 border-warning-100' : 'border-gray-100'}`}>
                      <p className={`text-xs font-medium ${isToday ? 'text-warning-600' : 'text-gray-500'}`}>
                        {new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(day)}
                      </p>
                      <p className={`text-lg font-semibold ${isToday ? 'text-warning-700' : 'text-gray-900'}`}>
                        {new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: timezone }).format(day)}
                      </p>
                    </div>
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, idx) => {
                          const isSelected = selectedSlot?.start === slot.start;
                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedSlot(slot)}
                              className={`w-full px-2 py-1.5 text-sm rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-warning-600 text-white font-medium'
                                  : 'text-gray-700 hover:bg-warning-50 hover:text-warning-700'
                              }`}
                            >
                              {formatTimeInZone(new Date(slot.start), timezone)}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">
                          {isWeekend ? 'Weekend' : 'No times'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          Powered by Acme Talent
        </div>
      </div>
    </div>
  );
}
