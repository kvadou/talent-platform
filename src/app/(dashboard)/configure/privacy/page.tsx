'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LockClosedIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Privacy & Compliance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage data privacy and compliance settings
        </p>
      </div>

      <Card>
        <CardHeader
          title="Data Retention"
          action={<Badge variant="success">Compliant</Badge>}
        />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Candidate Data Retention</p>
                <p className="text-sm text-gray-500">How long to keep candidate data after rejection</p>
              </div>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>1 year</option>
                <option>2 years</option>
                <option>3 years</option>
                <option>5 years</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Auto-delete inactive candidates</p>
                <p className="text-sm text-gray-500">Automatically remove candidates with no activity</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="GDPR Compliance" />
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="w-6 h-6 text-success-600" />
                <div>
                  <p className="font-medium text-gray-900">Consent Collection</p>
                  <p className="text-sm text-gray-500">Collect consent before storing candidate data</p>
                </div>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <LockClosedIcon className="w-6 h-6 text-success-600" />
                <div>
                  <p className="font-medium text-gray-900">Data Export Requests</p>
                  <p className="text-sm text-gray-500">Allow candidates to request their data</p>
                </div>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Data Deletion" />
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-danger-50 rounded-lg border border-danger-100">
            <div className="flex items-center gap-3">
              <TrashIcon className="w-6 h-6 text-danger-600" />
              <div>
                <p className="font-medium text-gray-900">Purge All Data</p>
                <p className="text-sm text-gray-500">Permanently delete all candidate data</p>
              </div>
            </div>
            <Button variant="outline" className="text-danger-600 border-danger-200 hover:bg-danger-100">
              Request Purge
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
