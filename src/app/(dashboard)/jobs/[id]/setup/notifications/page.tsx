'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  BellIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

type NotificationConfig = {
  id: string;
  type: string;
  recipients: string[];
  timing: string | null;
  isEnabled: boolean;
};

type TeamMember = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const NOTIFICATION_TYPES = [
  {
    type: 'NEW_APPLICANT',
    label: 'New Applicant',
    description: 'Notify when a new candidate applies',
    icon: EnvelopeIcon,
  },
  {
    type: 'NEW_INTERNAL_APPLICANT',
    label: 'New Internal Applicant',
    description: 'Notify when an internal candidate applies',
    icon: EnvelopeIcon,
  },
  {
    type: 'NEW_REFERRAL',
    label: 'New Referral',
    description: 'Notify when a referral is submitted',
    icon: EnvelopeIcon,
  },
  {
    type: 'NEW_AGENCY_SUBMISSION',
    label: 'New Agency Submission',
    description: 'Notify when an agency submits a candidate',
    icon: EnvelopeIcon,
  },
  {
    type: 'SCORECARD_REMINDER',
    label: 'Scorecard Reminder',
    description: 'Remind interviewers to submit scorecards',
    icon: BellIcon,
  },
  {
    type: 'NEW_SCORECARD',
    label: 'New Scorecard Submitted',
    description: 'Notify when a scorecard is submitted',
    icon: EnvelopeIcon,
  },
  {
    type: 'OFFER_APPROVED',
    label: 'Offer Approved',
    description: 'Notify when an offer is approved',
    icon: EnvelopeIcon,
  },
  {
    type: 'CANDIDATE_STAGE_CHANGE',
    label: 'Stage Change',
    description: 'Notify when a candidate moves to a new stage',
    icon: EnvelopeIcon,
  },
  {
    type: 'WEEKLY_RECRUITING_REPORT',
    label: 'Weekly Report',
    description: 'Send weekly recruiting summary',
    icon: BellIcon,
  },
];

const RECIPIENT_GROUPS = [
  { value: 'hiring_managers', label: 'Hiring Managers' },
  { value: 'recruiters', label: 'Recruiters' },
  { value: 'coordinators', label: 'Coordinators' },
];

export default function NotificationsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [notifRes, teamRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/notifications`),
        fetch(`/api/jobs/${jobId}/team`),
      ]);

      if (notifRes.ok) {
        const data = await notifRes.json();
        setConfigs(data.notifications || []);
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeamMembers(data.team || []);
      }
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleNotification(type: string, enabled: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, isEnabled: enabled }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update notification', err);
    } finally {
      setSaving(false);
    }
  }

  async function updateRecipients(type: string, recipients: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, recipients }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to update recipients', err);
    } finally {
      setSaving(false);
    }
  }

  function getConfig(type: string) {
    return configs.find((c) => c.type === type);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure when and who should receive notifications for this job.
        </p>
      </div>

      <Card>
        <CardHeader title="Email Notifications" />
        <CardContent>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((notifType) => {
              const config = getConfig(notifType.type);
              const isEnabled = config?.isEnabled ?? true;
              const Icon = notifType.icon;

              return (
                <div
                  key={notifType.type}
                  className={`p-4 rounded-lg border ${
                    isEnabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        isEnabled ? 'bg-brand-purple/10 text-brand-purple' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4
                            className={`font-medium ${
                              isEnabled ? 'text-gray-900' : 'text-gray-500'
                            }`}
                          >
                            {notifType.label}
                          </h4>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {notifType.description}
                          </p>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) =>
                              toggleNotification(notifType.type, e.target.checked)
                            }
                            className="sr-only peer"
                            disabled={saving}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-purple rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
                        </label>
                      </div>

                      {isEnabled && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-500 mb-2">
                            Recipients
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {RECIPIENT_GROUPS.map((group) => {
                              const isSelected =
                                config?.recipients?.includes(group.value) ?? false;
                              return (
                                <button
                                  key={group.value}
                                  onClick={() => {
                                    const current = config?.recipients || [];
                                    const updated = isSelected
                                      ? current.filter((r) => r !== group.value)
                                      : [...current, group.value];
                                    updateRecipients(notifType.type, updated);
                                  }}
                                  disabled={saving}
                                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                    isSelected
                                      ? 'bg-brand-purple text-white border-brand-purple'
                                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-purple'
                                  }`}
                                >
                                  {group.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
