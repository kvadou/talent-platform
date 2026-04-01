'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertModal } from '@/components/ui/AlertModal';

interface CandidateAvailability {
  id: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

interface AvailabilityLink {
  id: string;
  token: string;
  status: 'PENDING' | 'SUBMITTED' | 'SCHEDULED' | 'EXPIRED' | 'CANCELLED';
  duration: number;
  instructions: string | null;
  submittedAt: string | null;
  createdAt: string;
  application: {
    id: string;
    candidate: {
      firstName: string;
      lastName: string;
      email: string;
    };
    job: {
      title: string;
    };
  };
  stage: {
    name: string;
  };
  availabilities: CandidateAvailability[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Awaiting Response', className: 'bg-yellow-100 text-yellow-800' },
  SUBMITTED: { label: 'Ready to Schedule', className: 'bg-success-100 text-success-800' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-cyan-100 text-cyan-800' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: 'Cancelled', className: 'bg-danger-100 text-danger-800' }
};

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateStr));
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateStr));
}

function ScheduleModal({
  link,
  onClose,
  onScheduled
}: {
  link: AvailabilityLink;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [selectedWindow, setSelectedWindow] = useState<CandidateAvailability | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group availability by date
  const availabilityByDate = link.availabilities.reduce((acc, a) => {
    const date = new Date(a.startTime).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {} as Record<string, CandidateAvailability[]>);

  // Generate time slots for selected window
  const timeSlots: { start: Date; end: Date }[] = [];
  if (selectedWindow) {
    const windowStart = new Date(selectedWindow.startTime);
    const windowEnd = new Date(selectedWindow.endTime);
    let current = new Date(windowStart);

    while (current.getTime() + link.duration * 60 * 1000 <= windowEnd.getTime()) {
      const end = new Date(current.getTime() + link.duration * 60 * 1000);
      timeSlots.push({ start: new Date(current), end });
      current = new Date(current.getTime() + 30 * 60 * 1000); // 30 min increments
    }
  }

  const handleSchedule = async () => {
    if (!selectedTime) return;

    const slot = timeSlots.find(s => s.start.toISOString() === selectedTime);
    if (!slot) return;

    setScheduling(true);
    setError(null);

    try {
      const res = await fetch(`/api/availability-links/${link.token}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: slot.start.toISOString(),
          endTime: slot.end.toISOString()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to schedule interview');
      }

      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Schedule Interview</h2>
              <p className="text-sm text-gray-500">
                {link.application.candidate.firstName} {link.application.candidate.lastName} • {link.application.job.title}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Interview duration: <span className="font-medium">{link.duration} minutes</span>
            </p>
          </div>

          {/* Step 1: Select date/window */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              1. Select availability window
            </h3>
            <div className="space-y-3">
              {Object.entries(availabilityByDate).map(([date, windows]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">{date}</p>
                  <div className="space-y-2">
                    {windows.map(window => (
                      <button
                        key={window.id}
                        onClick={() => {
                          setSelectedWindow(window);
                          setSelectedTime('');
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          selectedWindow?.id === window.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <span className="font-medium text-gray-900">
                          {formatTime(window.startTime)} - {formatTime(window.endTime)}
                        </span>
                        {window.note && (
                          <p className="text-xs text-gray-500 mt-1">{window.note}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Select specific time */}
          {selectedWindow && timeSlots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                2. Select interview time
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map(slot => (
                  <button
                    key={slot.start.toISOString()}
                    onClick={() => setSelectedTime(slot.start.toISOString())}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedTime === slot.start.toISOString()
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-gray-200 hover:border-purple-300 text-gray-700'
                    }`}
                  >
                    {formatTime(slot.start.toISOString())}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={!selectedTime || scheduling}
            >
              {scheduling ? 'Scheduling...' : 'Schedule Interview'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchedulingDashboardPage() {
  const [links, setLinks] = useState<AvailabilityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'SUBMITTED' | 'SCHEDULED'>('all');
  const [schedulingLink, setSchedulingLink] = useState<AvailabilityLink | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/availability-links?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
      }
    } catch (error) {
      console.error('Failed to fetch availability links:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const filteredLinks = filter === 'all'
    ? links
    : links.filter(l => l.status === filter);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/availability/${token}`;
    navigator.clipboard.writeText(url);
    setAlertMsg('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Scheduling</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage candidate availability and schedule interviews
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'PENDING', 'SUBMITTED', 'SCHEDULED'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === status
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'all' ? 'All' : STATUS_BADGES[status].label}
          </button>
        ))}
      </div>

      {/* Links list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : filteredLinks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Availability Requests</h3>
            <p className="text-gray-500">
              Send availability requests to candidates from the application details page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLinks.map(link => (
            <Card key={link.id}>
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-gray-900">
                        {link.application.candidate.firstName} {link.application.candidate.lastName}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGES[link.status].className}`}>
                        {STATUS_BADGES[link.status].label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {link.application.job.title} • {link.stage.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Sent {formatDateTime(link.createdAt)}
                      {link.submittedAt && ` • Submitted ${formatDateTime(link.submittedAt)}`}
                    </p>

                    {/* Show availability preview for submitted links */}
                    {link.status === 'SUBMITTED' && link.availabilities.length > 0 && (
                      <div className="mt-3 p-3 bg-success-50 rounded-lg">
                        <p className="text-xs font-medium text-success-800 mb-2">
                          Available times ({link.availabilities.length} windows)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {link.availabilities.slice(0, 4).map(a => (
                            <span key={a.id} className="text-xs bg-white px-2 py-1 rounded text-gray-600">
                              {formatDateTime(a.startTime)} - {formatTime(a.endTime)}
                            </span>
                          ))}
                          {link.availabilities.length > 4 && (
                            <span className="text-xs text-success-600">
                              +{link.availabilities.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {link.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(link.token)}
                      >
                        Copy Link
                      </Button>
                    )}
                    {link.status === 'SUBMITTED' && (
                      <Button
                        size="sm"
                        onClick={() => setSchedulingLink(link)}
                      >
                        Schedule Interview
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />

      {/* Schedule Modal */}
      {schedulingLink && (
        <ScheduleModal
          link={schedulingLink}
          onClose={() => setSchedulingLink(null)}
          onScheduled={() => {
            setSchedulingLink(null);
            fetchLinks();
          }}
        />
      )}
    </div>
  );
}
