'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { debounce } from 'lodash';

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  schedulingUsername: string | null;
  timezone: string | null;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (HKT)' },
];

export default function AccountProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedulingUsername, setSchedulingUsername] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch profile data
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/account/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setSchedulingUsername(data.schedulingUsername || '');
          setTimezone(data.timezone || 'America/Chicago');
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  // Debounced username availability check
  const checkUsernameAvailability = useMemo(
    () => debounce(async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameStatus('idle');
        return;
      }

      // Validate format: lowercase, alphanumeric, hyphens only
      if (!/^[a-z0-9-]+$/.test(username)) {
        setUsernameStatus('invalid');
        return;
      }

      setUsernameStatus('checking');
      try {
        const res = await fetch(`/api/account/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch (error) {
        console.error('Failed to check username:', error);
        setUsernameStatus('idle');
      }
    }, 500),
    []
  );

  useEffect(() => {
    return () => {
      checkUsernameAvailability.cancel();
    };
  }, [checkUsernameAvailability]);

  // Handle username change
  const handleUsernameChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSchedulingUsername(normalized);
    if (normalized !== profile?.schedulingUsername) {
      checkUsernameAvailability(normalized);
    } else {
      setUsernameStatus('idle');
    }
  };

  // Save profile
  const handleSave = async () => {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;

    setSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedulingUsername: schedulingUsername || null,
          timezone,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setSaveMessage({ type: 'success', text: 'Profile saved successfully!' });
        setUsernameStatus('idle');
      } else {
        const error = await res.json();
        setSaveMessage({ type: 'error', text: error.error || 'Failed to save profile' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'An error occurred while saving' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Copy scheduling link
  const copySchedulingLink = () => {
    const url = `${window.location.origin}/meet/${schedulingUsername}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || status === 'loading') {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-slate-200 rounded-full" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="space-y-4">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-12 w-full bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const previewUrl = schedulingUsername
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/meet/${schedulingUsername}`
    : null;

  return (
    <div className="divide-y divide-slate-100">
      {/* Header Section */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Avatar */}
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || 'Profile'}
              width={80}
              height={80}
              unoptimized
              className="w-20 h-20 rounded-full ring-4 ring-purple-100 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center ring-4 ring-purple-100">
              <UserCircleIcon className="w-12 h-12 text-white" />
            </div>
          )}

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {profile?.firstName} {profile?.lastName}
            </h2>
            <p className="text-slate-500 mt-1">{profile?.email}</p>
          </div>
        </div>
      </div>

      {/* Scheduling Username Section */}
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-purple-600" />
            Scheduling Link
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Create a personalized URL for your scheduling page
          </p>
        </div>

        {/* Username Input with Live Preview */}
        <div className="space-y-4">
          <div>
            <label htmlFor="schedulingUsername" className="block text-sm font-medium text-slate-700 mb-2">
              Your scheduling username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-400 text-sm">/schedule/</span>
              </div>
              <input
                type="text"
                id="schedulingUsername"
                value={schedulingUsername}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="your-name"
                className={`
                  w-full pl-24 pr-12 py-3 rounded-xl border-2 text-slate-900 placeholder:text-slate-300
                  transition-all duration-200 focus:outline-none focus:ring-4
                  ${usernameStatus === 'available' ? 'border-success-400 focus:border-success-500 focus:ring-green-100' : ''}
                  ${usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-danger-400 focus:border-danger-500 focus:ring-red-100' : ''}
                  ${usernameStatus === 'idle' || usernameStatus === 'checking' ? 'border-slate-200 focus:border-purple-500 focus:ring-purple-100' : ''}
                `}
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                {usernameStatus === 'checking' && (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <CheckCircleIcon className="w-5 h-5 text-success-500" />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <ExclamationCircleIcon className="w-5 h-5 text-danger-500" />
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {usernameStatus === 'invalid' && (
                  <span className="text-danger-500">Only lowercase letters, numbers, and hyphens allowed</span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-danger-500">This username is already taken</span>
                )}
                {usernameStatus === 'available' && (
                  <span className="text-success-600">This username is available!</span>
                )}
                {(usernameStatus === 'idle' || usernameStatus === 'checking') && (
                  <span>Minimum 3 characters</span>
                )}
              </p>
            </div>
          </div>

          {/* Live Preview Card */}
          {previewUrl && schedulingUsername.length >= 3 && (
            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50 to-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">
                    Your Scheduling Page
                  </p>
                  <p className="text-sm font-mono text-slate-700 truncate">
                    {previewUrl}
                  </p>
                </div>
                <button
                  onClick={copySchedulingLink}
                  disabled={usernameStatus === 'taken' || usernameStatus === 'invalid'}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${copied
                      ? 'bg-success-100 text-success-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {copied ? (
                    <>
                      <ClipboardDocumentCheckIcon className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timezone Section */}
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <GlobeAltIcon className="w-5 h-5 text-purple-600" />
            Timezone
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            All scheduling will be based on this timezone
          </p>
        </div>

        <div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-900
                       focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-500
                       transition-all duration-200 bg-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="p-6 sm:p-8 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {saveMessage && (
            <div
              className={`flex items-center gap-2 text-sm ${
                saveMessage.type === 'success' ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              {saveMessage.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <ExclamationCircleIcon className="w-5 h-5" />
              )}
              {saveMessage.text}
            </div>
          )}
          <div className="sm:ml-auto">
            <button
              onClick={handleSave}
              disabled={saving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700
                         text-white font-medium rounded-xl shadow-lg shadow-purple-200
                         hover:from-purple-700 hover:to-purple-800
                         focus:outline-none focus:ring-4 focus:ring-purple-200
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
