'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { Button } from '@/components/ui/Button';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

type SchedulingPreferences = {
  timezone: string;
  useCalendly: boolean;
  calendlyLink: string;
  defaultBufferBefore: number;
  defaultBufferAfter: number;
  showTimezoneToInvitee: boolean;
  autoDetectTimezone: boolean;
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
];

const defaultPreferences: SchedulingPreferences = {
  timezone: 'America/Chicago',
  useCalendly: false,
  calendlyLink: '',
  defaultBufferBefore: 5,
  defaultBufferAfter: 5,
  showTimezoneToInvitee: true,
  autoDetectTimezone: true,
};

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<SchedulingPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const res = await fetch('/api/scheduling/preferences');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setPreferences({ ...defaultPreferences, ...data });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/scheduling/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling Preferences</h1>
          <p className="mt-1 text-gray-600">
            Configure your timezone, default settings, and scheduling method.
          </p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>

      <div className="space-y-6">
        {/* Scheduling Method */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Scheduling Method</h2>
            <p className="text-sm text-gray-600 mt-1">
              Choose between using Calendly or our built-in scheduling system.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900">Use Calendly</label>
                <p className="text-sm text-gray-600 mt-1">
                  Enable this to use your Calendly link instead of the built-in scheduler.
                </p>
              </div>
              <Switch
                checked={preferences.useCalendly}
                onChange={(checked) => setPreferences({ ...preferences, useCalendly: checked })}
                className={`${
                  preferences.useCalendly ? 'bg-brand-purple' : 'bg-gray-300'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2`}
              >
                <span
                  className={`${
                    preferences.useCalendly ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </Switch>
            </div>

            {preferences.useCalendly && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Calendly Link
                </label>
                <input
                  type="url"
                  placeholder="https://calendly.com/your-username/meeting"
                  value={preferences.calendlyLink}
                  onChange={(e) =>
                    setPreferences({ ...preferences, calendlyLink: e.target.value })
                  }
                  className="block w-full max-w-lg rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter your Calendly scheduling link that will be used for candidate bookings.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timezone Settings */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Timezone Settings</h2>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="block w-full max-w-md rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900">Auto-Detect Invitee Timezone</label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically detect and display times in the candidate&apos;s timezone.
                </p>
              </div>
              <Switch
                checked={preferences.autoDetectTimezone}
                onChange={(checked) =>
                  setPreferences({ ...preferences, autoDetectTimezone: checked })
                }
                className={`${
                  preferences.autoDetectTimezone ? 'bg-brand-purple' : 'bg-gray-300'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2`}
              >
                <span
                  className={`${
                    preferences.autoDetectTimezone ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </Switch>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900">Show Timezone to Invitee</label>
                <p className="text-sm text-gray-600 mt-1">
                  Display the timezone on the booking page for clarity.
                </p>
              </div>
              <Switch
                checked={preferences.showTimezoneToInvitee}
                onChange={(checked) =>
                  setPreferences({ ...preferences, showTimezoneToInvitee: checked })
                }
                className={`${
                  preferences.showTimezoneToInvitee ? 'bg-brand-purple' : 'bg-gray-300'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2`}
              >
                <span
                  className={`${
                    preferences.showTimezoneToInvitee ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </Switch>
            </div>
          </div>
        </div>

        {/* Buffer Times */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Default Buffer Times</h2>
            <p className="text-sm text-gray-600 mt-1">
              Set default buffer times before and after meetings. These can be overridden per
              meeting type.
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buffer Before Meeting
                </label>
                <select
                  value={preferences.defaultBufferBefore}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultBufferBefore: parseInt(e.target.value),
                    })
                  }
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                >
                  {BUFFER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Time blocked before each meeting for preparation.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buffer After Meeting
                </label>
                <select
                  value={preferences.defaultBufferAfter}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultBufferAfter: parseInt(e.target.value),
                    })
                  }
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple"
                >
                  {BUFFER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Time blocked after each meeting for notes and breaks.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-cyan-50 rounded-lg flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-cyan-700">
                Buffer times prevent back-to-back meetings by blocking time on your calendar. A
                5-minute buffer is recommended to allow for breaks between calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
