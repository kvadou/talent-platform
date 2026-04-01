'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircleIcon, ExclamationCircleIcon, CheckIcon } from '@heroicons/react/24/outline';

type EmailSettings = {
  domain: string;
  domainVerified: boolean;
  fromAddress: string;
  replyToAddress: string;
};

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>({
    domain: '',
    domainVerified: false,
    fromAddress: '',
    replyToAddress: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/email-settings');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      setError('Failed to load email settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailDomain: settings.domain || null,
          emailFromAddress: settings.fromAddress || null,
          emailReplyToAddress: settings.replyToAddress || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save email settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Email Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage email domain settings for your organization
          </p>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading email settings...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Email Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage email domain settings for your organization
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saved ? (
            <>
              <CheckIcon className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : saving ? (
            'Saving...'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Domain Configuration" />
        <CardContent>
          <div className="space-y-4">
            <div
              className={`flex items-center justify-between p-4 rounded-lg border ${
                settings.domainVerified
                  ? 'bg-success-50 border-success-100'
                  : 'bg-yellow-50 border-yellow-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {settings.domainVerified ? (
                  <CheckCircleIcon className="w-6 h-6 text-success-600" />
                ) : (
                  <ExclamationCircleIcon className="w-6 h-6 text-yellow-600" />
                )}
                <div>
                  <input
                    type="text"
                    value={settings.domain}
                    onChange={(e) => setSettings({ ...settings, domain: e.target.value })}
                    className="font-medium text-gray-900 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    placeholder="yourdomain.com"
                  />
                  <p
                    className={`text-sm ${
                      settings.domainVerified ? 'text-success-600' : 'text-yellow-600'
                    }`}
                  >
                    {settings.domainVerified ? 'Verified and active' : 'Pending verification'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Email Sending" />
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default From Address
              </label>
              <input
                type="email"
                value={settings.fromAddress}
                onChange={(e) => setSettings({ ...settings, fromAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="recruiting@yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the address that will appear in the &quot;From&quot; field of outgoing emails.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reply-To Address
              </label>
              <input
                type="email"
                value={settings.replyToAddress}
                onChange={(e) => setSettings({ ...settings, replyToAddress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="careers@yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Replies to your emails will be sent to this address.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
