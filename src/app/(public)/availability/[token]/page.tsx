'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type AvailabilityWindow = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

type LinkInfo = {
  jobTitle: string;
  candidateName: string;
  duration: number;
  timezone: string;
  instructions: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  status: string;
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

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7; // Start at 7am
  const minute = i % 2 === 0 ? '00' : '30';
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return { value: time24, label: `${hour12}:${minute} ${ampm}` };
});

function getNextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= count; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export default function AvailabilityPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [note, setNote] = useState('');

  // Availability windows - keyed by date
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);

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
        const res = await fetch(`/api/availability-links/${token}/info`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load availability request');
        }

        const info = await res.json();
        setLinkInfo(info);

        if (info.status === 'SUBMITTED') {
          setSubmitted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const addWindow = useCallback((date: string) => {
    setWindows(prev => [
      ...prev,
      { date, startTime: '09:00', endTime: '17:00' }
    ]);
  }, []);

  const updateWindow = useCallback((index: number, field: keyof AvailabilityWindow, value: string) => {
    setWindows(prev => prev.map((w, i) =>
      i === index ? { ...w, [field]: value } : w
    ));
  }, []);

  const removeWindow = useCallback((index: number) => {
    setWindows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (windows.length === 0) {
      setError('Please add at least one availability window');
      return;
    }

    // Validate all windows
    for (const window of windows) {
      if (window.startTime >= window.endTime) {
        setError('End time must be after start time for all windows');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/availability-links/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          windows: windows.map(w => ({
            date: w.date,
            startTime: w.startTime,
            endTime: w.endTime
          })),
          timezone,
          note: note.trim() || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit availability');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit availability');
    } finally {
      setSubmitting(false);
    }
  };

  // Group windows by date
  const windowsByDate = windows.reduce((acc, window, index) => {
    if (!acc[window.date]) acc[window.date] = [];
    acc[window.date].push({ ...window, index });
    return acc;
  }, {} as Record<string, (AvailabilityWindow & { index: number })[]>);

  // Get available dates (next 30 days)
  const availableDates = getNextDays(30);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-success-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
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

  // Already submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Availability Submitted!</h1>
          <p className="text-gray-600 mb-4">
            Thank you for sharing your availability. Our team will review and schedule your interview soon.
          </p>
          <p className="text-sm text-gray-500">
            You&apos;ll receive a calendar invitation once your interview is confirmed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Share Your Availability</h1>
                {linkInfo && (
                  <p className="text-success-200">{linkInfo.jobTitle}</p>
                )}
              </div>
            </div>
            {linkInfo && (
              <p className="text-success-100 text-sm">
                Hi {linkInfo.candidateName.split(' ')[0]}! Please let us know when you&apos;re available for your interview
                ({linkInfo.duration} minutes).
              </p>
            )}
          </div>

          <div className="p-6">
            {/* Instructions */}
            {linkInfo?.instructions && (
              <div className="mb-6 bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-cyan-800 mb-1">Instructions</h3>
                <p className="text-sm text-cyan-700">{linkInfo.instructions}</p>
              </div>
            )}

            {/* Timezone selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-success-500 focus:border-transparent"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Add availability windows */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">Your Availability</h3>
                <span className="text-sm text-gray-500">
                  {windows.length} {windows.length === 1 ? 'window' : 'windows'} added
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Select dates and times when you&apos;re available for the interview. Add multiple windows if needed.
              </p>

              {/* Date pills to add windows */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {availableDates.slice(0, 14).map(date => {
                    const dateStr = formatDate(date);
                    const hasWindows = windowsByDate[dateStr]?.length > 0;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => addWindow(dateStr)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          hasWindows
                            ? 'bg-success-100 border-success-300 text-success-800'
                            : isWeekend
                              ? 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-success-50 hover:border-success-200'
                        }`}
                      >
                        {formatDisplayDate(date)}
                        {hasWindows && (
                          <span className="ml-1 text-success-600">
                            ({windowsByDate[dateStr].length})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click a date to add an availability window
                </p>
              </div>

              {/* Windows list */}
              {windows.length > 0 && (
                <div className="space-y-3 mb-4">
                  {Object.entries(windowsByDate).sort().map(([date, dateWindows]) => (
                    <div key={date} className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        {formatDisplayDate(new Date(date + 'T12:00:00'))}
                      </h4>
                      <div className="space-y-2">
                        {dateWindows.map((window) => (
                          <div key={window.index} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200">
                            <select
                              value={window.startTime}
                              onChange={(e) => updateWindow(window.index, 'startTime', e.target.value)}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-success-500 focus:border-transparent"
                            >
                              {TIME_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <span className="text-gray-400">to</span>
                            <select
                              value={window.endTime}
                              onChange={(e) => updateWindow(window.index, 'endTime', e.target.value)}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-success-500 focus:border-transparent"
                            >
                              {TIME_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeWindow(window.index)}
                              className="p-1.5 text-gray-400 hover:text-danger-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addWindow(date)}
                          className="w-full py-1.5 text-sm text-success-600 hover:text-success-700 hover:bg-success-50 rounded-lg transition-colors"
                        >
                          + Add another time
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {windows.length === 0 && (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Click a date above to add your availability</p>
                </div>
              )}
            </div>

            {/* Optional note */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional notes (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Any scheduling preferences or constraints..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-success-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Error display */}
            {error && (
              <div className="mb-4 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || windows.length === 0}
              className="w-full py-3 px-4 text-white font-medium bg-success-600 rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Availability'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Powered by Acme Talent
        </div>
      </div>
    </div>
  );
}
