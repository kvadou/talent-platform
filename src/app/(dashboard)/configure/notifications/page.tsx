'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  BellIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';

type NotificationSetting = {
  id: string;
  name: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
  category: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/users/me/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      setNotifications(data.notifications);
    } catch (err) {
      setError('Failed to load notification preferences');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleNotification(id: string, channel: 'email' | 'push' | 'sms') {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, [channel]: !n[channel] } : n
      )
    );
    setHasChanges(true);
  }

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      setNotifications(data.notifications);
      setHasChanges(false);
    } catch (err) {
      setError('Failed to save notification preferences');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set(notifications.map((n) => n.category))];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure how and when you receive notifications
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading preferences...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how and when you receive notifications
          </p>
        </div>
        <Button onClick={saveChanges} disabled={!hasChanges || saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <EnvelopeIcon className="w-4 h-4" />
          Email
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <BellIcon className="w-4 h-4" />
          Push
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <DevicePhoneMobileIcon className="w-4 h-4" />
          SMS
        </div>
      </div>

      {categories.map((category) => (
        <Card key={category}>
          <CardHeader title={category} />
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {notifications
                .filter((n) => n.category === category)
                .map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {notification.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {notification.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Email Toggle */}
                      <button
                        onClick={() => toggleNotification(notification.id, 'email')}
                        className={`p-2 rounded-lg transition-colors ${
                          notification.email
                            ? 'bg-purple-100 text-brand-purple'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                        title="Email notifications"
                      >
                        <EnvelopeIcon className="w-4 h-4" />
                      </button>

                      {/* Push Toggle */}
                      <button
                        onClick={() => toggleNotification(notification.id, 'push')}
                        className={`p-2 rounded-lg transition-colors ${
                          notification.push
                            ? 'bg-purple-100 text-brand-purple'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                        title="Push notifications"
                      >
                        <BellIcon className="w-4 h-4" />
                      </button>

                      {/* SMS Toggle */}
                      <button
                        onClick={() => toggleNotification(notification.id, 'sms')}
                        className={`p-2 rounded-lg transition-colors ${
                          notification.sms
                            ? 'bg-purple-100 text-brand-purple'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                        title="SMS notifications"
                      >
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
