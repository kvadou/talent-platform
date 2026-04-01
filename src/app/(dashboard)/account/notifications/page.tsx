'use client';

import { useState, useEffect } from 'react';
import {
  BellIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
}

const defaultSettings: NotificationSetting[] = [
  {
    id: 'new_application',
    label: 'New Applications',
    description: 'When a candidate applies to one of your jobs',
    email: true,
    push: true,
  },
  {
    id: 'interview_scheduled',
    label: 'Interview Scheduled',
    description: 'When an interview is booked on your calendar',
    email: true,
    push: true,
  },
  {
    id: 'interview_reminder',
    label: 'Interview Reminders',
    description: '15 minutes before your scheduled interviews',
    email: false,
    push: true,
  },
  {
    id: 'candidate_response',
    label: 'Candidate Responses',
    description: 'When a candidate replies to your messages',
    email: true,
    push: false,
  },
  {
    id: 'team_mentions',
    label: 'Team Mentions',
    description: 'When someone mentions you in a comment',
    email: true,
    push: true,
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load settings - for now just use defaults
    setLoading(false);
  }, []);

  const toggleSetting = (id: string, channel: 'email' | 'push') => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? { ...setting, [channel]: !setting[channel] }
          : setting
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: Save to API
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const icons: { [key: string]: typeof BellIcon } = {
    new_application: UserGroupIcon,
    interview_scheduled: CalendarDaysIcon,
    interview_reminder: BellIcon,
    candidate_response: ChatBubbleLeftIcon,
    team_mentions: UserGroupIcon,
  };

  return (
    <div className="divide-y divide-slate-100">
      {/* Header */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BellIcon className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Notification Preferences</h2>
        </div>
        <p className="text-slate-500 ml-12">
          Choose how you want to be notified about activity in your account.
        </p>
      </div>

      {/* Channel Headers */}
      <div className="px-6 sm:px-8 py-4 bg-slate-50">
        <div className="flex items-center justify-end gap-8 pr-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <EnvelopeIcon className="w-4 h-4" />
            Email
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <DevicePhoneMobileIcon className="w-4 h-4" />
            Push
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="divide-y divide-slate-100">
        {settings.map((setting) => {
          const Icon = icons[setting.id] || BellIcon;
          return (
            <div
              key={setting.id}
              className="flex items-center justify-between px-6 sm:px-8 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{setting.label}</h3>
                  <p className="text-sm text-slate-500">{setting.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                {/* Email Toggle */}
                <button
                  onClick={() => toggleSetting(setting.id, 'email')}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors
                    ${setting.email ? 'bg-purple-600' : 'bg-slate-200'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                      ${setting.email ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
                {/* Push Toggle */}
                <button
                  onClick={() => toggleSetting(setting.id, 'push')}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors
                    ${setting.push ? 'bg-purple-600' : 'bg-slate-200'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                      ${setting.push ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="p-6 sm:p-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-200 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        <p className="text-sm text-slate-500 mt-2">
          Note: Push notifications require browser permission.
        </p>
      </div>
    </div>
  );
}
