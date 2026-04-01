'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function DomainSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Domain Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure and verify your email domain
        </p>
      </div>

      <Card>
        <CardHeader title="Verified Domains" />
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-success-50 rounded-lg border border-success-100">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-6 h-6 text-success-600" />
              <div>
                <p className="font-medium text-gray-900">acmetalent.com</p>
                <p className="text-sm text-success-600">SPF, DKIM, and DMARC verified</p>
              </div>
            </div>
            <Button variant="outline" size="sm">View Records</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Add New Domain" />
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter domain (e.g., company.com)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <Button>Add Domain</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
