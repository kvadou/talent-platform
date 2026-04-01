'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface CalendarIntegration {
  id: string;
  provider: string;
  calendarId: string | null;
  isActive: boolean;
  lastSynced: string | null;
}

export default function CalendarConnectionsPage() {
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState<CalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success === 'google_connected') {
      setStatusMessage({ type: 'success', text: 'Google Calendar connected successfully!' });
    } else if (error === 'oauth_failed') {
      setStatusMessage({ type: 'error', text: 'Failed to connect Google Calendar. Please try again.' });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const res = await fetch('/api/account/calendar');
      if (res.ok) {
        const data = await res.json();
        setIntegration(data.google || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/auth/google');
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUrl;
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to start Google connection.' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConfirmDisconnect(false);
    try {
      const res = await fetch('/api/account/calendar', { method: 'DELETE' });
      if (res.ok) {
        setIntegration(null);
        setStatusMessage({ type: 'success', text: 'Google Calendar disconnected.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to disconnect.' });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-24 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {/* Header */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <CalendarDaysIcon className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Calendar Connections</h2>
        </div>
        <p className="text-slate-500 ml-12">
          Connect your calendar to automatically check availability and sync scheduled meetings.
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="px-6 sm:px-8 pt-4">
          <div
            className={`p-4 rounded-xl flex items-center gap-3 ${
              statusMessage.type === 'success'
                ? 'bg-success-50 border border-success-200 text-success-800'
                : 'bg-danger-50 border border-danger-200 text-danger-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircleIcon className="w-5 h-5 text-success-600" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-danger-600" />
            )}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Google Calendar */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Google Calendar</h3>
              {integration ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <CheckCircleIcon className="w-4 h-4 text-success-500" />
                  <span className="text-sm text-success-700">Connected</span>
                  {integration.calendarId && (
                    <span className="text-sm text-slate-400">· {integration.calendarId}</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Sync events and check availability</p>
              )}
            </div>
          </div>
          {integration ? (
            <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} loading={connecting}>
              Connect
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
          <div className="flex gap-3">
            <CalendarDaysIcon className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-cyan-800">
              <p className="font-medium">How it works</p>
              <p className="mt-1">
                When connected, your scheduling links will automatically check your Google Calendar
                for conflicts and block out busy times. Booked meetings will also be added to your calendar.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Google Calendar"
        message="Your scheduling links will no longer check Google Calendar for conflicts. Are you sure?"
        confirmLabel="Disconnect"
        variant="danger"
      />
    </div>
  );
}
