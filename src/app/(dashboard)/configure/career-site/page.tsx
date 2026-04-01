'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { GlobeAltIcon, EyeIcon, CheckIcon } from '@heroicons/react/24/outline';

type CareerSiteSettings = {
  url: string;
  logo: string;
  primaryColor: string;
  headline: string;
  description: string;
};

export default function CareerSitePage() {
  const [settings, setSettings] = useState<CareerSiteSettings>({
    url: '',
    logo: '',
    primaryColor: '#7C3AED',
    headline: 'Join Our Team',
    description: '',
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
      const response = await fetch('/api/career-site');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      setError('Failed to load career site settings');
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
      const response = await fetch('/api/career-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careerSiteUrl: settings.url || null,
          careerSiteLogo: settings.logo || null,
          careerSitePrimaryColor: settings.primaryColor || null,
          careerSiteHeadline: settings.headline || null,
          careerSiteDescription: settings.description || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save career site settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Career Site</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your organization&apos;s job seeker settings
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading career site settings...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Career Site</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your organization&apos;s job seeker settings
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/careers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <EyeIcon className="w-4 h-4 mr-2" />
            Preview Site
          </a>
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
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Site URL" />
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <GlobeAltIcon className="w-8 h-8 text-brand-purple" />
            <div className="flex-1">
              <input
                type="text"
                value={settings.url}
                onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="careers.yourcompany.com"
              />
              <p className="text-sm text-gray-500 mt-1">Your public careers page URL</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Branding" />
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Logo URL
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border">
                  {settings.logo ? (
                    <Image
                      src={settings.logo}
                      alt="Logo"
                      width={64}
                      height={64}
                      unoptimized
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">Logo</span>
                  )}
                </div>
                <input
                  type="text"
                  value={settings.logo}
                  onChange={(e) => setSettings({ ...settings, logo: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Content" />
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Headline
              </label>
              <input
                type="text"
                value={settings.headline}
                onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Join Our Team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Tell candidates about your company and culture..."
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
