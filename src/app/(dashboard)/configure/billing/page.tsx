'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CreditCardIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your account team and plan details
        </p>
      </div>

      <Card>
        <CardHeader
          title="Current Plan"
          action={<Badge variant="success">Active</Badge>}
        />
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Professional</h3>
              <p className="text-gray-500 mt-1">Unlimited jobs, candidates, and users</p>
            </div>
            <Button variant="outline">Change Plan</Button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Team Members</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Candidates</p>
              <p className="text-2xl font-bold text-gray-900">1,234</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Payment Method" />
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCardIcon className="w-8 h-8 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                <p className="text-sm text-gray-500">Expires 12/2025</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Update</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Billing Contact" />
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Admin User</p>
              <p className="text-sm text-gray-500">doug@acmetalent.com</p>
            </div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
