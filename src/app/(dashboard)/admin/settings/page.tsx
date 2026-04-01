'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertModal } from '@/components/ui/AlertModal';
import { useSearchParams } from 'next/navigation';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check Google Calendar connection status
    fetch('/api/auth/google/status')
      .then((res) => res.json())
      .then((data) => {
        setGoogleConnected(data.connected || false);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Check for success/error messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'google_connected') {
      setGoogleConnected(true);
    }
    if (error) {
      setAlertMsg(`Error: ${error}`);
    }
  }, [searchParams]);

  async function connectGoogle() {
    try {
      const res = await fetch('/api/auth/google');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      setAlertMsg('Failed to initiate Google Calendar connection');
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />

      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600">Manage integrations and system settings.</p>
      </div>

      <Card>
        <CardHeader title="Google Calendar Integration" />
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-gray-900 mb-1">Calendar Connection</div>
              <div className="text-sm text-gray-600">
                Connect your Google Calendar to enable self-scheduling for candidates.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {googleConnected ? (
                <>
                  <Badge variant="success">Connected</Badge>
                  <Button variant="secondary" onClick={connectGoogle} className="w-full sm:w-auto">
                    Reconnect
                  </Button>
                </>
              ) : (
                <Button onClick={connectGoogle} className="w-full sm:w-auto">Connect Google Calendar</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Automation Settings" />
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="font-semibold text-gray-900 mb-1">Background Jobs</div>
              <div className="text-sm text-gray-600">
                Configure Heroku Scheduler to run automation jobs:
              </div>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg font-mono text-xs">
                <div># Process email sequences (every hour)</div>
                <div>curl -X POST https://hiring.acmetalent.com/api/cron/process-sequences \</div>
                <div className="pl-4">-H &quot;Authorization: Bearer $CRON_SECRET&quot;</div>
                <div className="mt-2"># Check SLA breaches (every 6 hours)</div>
                <div>curl -X POST https://hiring.acmetalent.com/api/cron/check-slas \</div>
                <div className="pl-4">-H &quot;Authorization: Bearer $CRON_SECRET&quot;</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
