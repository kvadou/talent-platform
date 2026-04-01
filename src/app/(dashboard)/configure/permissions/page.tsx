'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheckIcon, UsersIcon } from '@heroicons/react/24/outline';

type RoleInfo = {
  role: string;
  name: string;
  description: string;
  userCount: number;
  isSystem: boolean;
};

type Totals = {
  totalUsers: number;
  totalRoles: number;
};

export default function PermissionsPage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  async function fetchPermissions() {
    try {
      const response = await fetch('/api/permissions');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setRoles(data.roles);
      setTotals(data.totals);
    } catch (err) {
      setError('Failed to load permission policies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Permission Policies</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage permission policies for your organization
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading permission policies...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Permission Policies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage permission policies for your organization
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {totals && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <ShieldCheckIcon className="w-5 h-5 text-brand-purple" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.totalRoles}</p>
                  <p className="text-xs text-gray-500">Permission Roles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <UsersIcon className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.totalUsers}</p>
                  <p className="text-xs text-gray-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="Roles" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {roles.map((role) => (
              <div key={role.role} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{role.name}</span>
                    <Badge variant="neutral">System</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
        <p className="text-sm text-cyan-800">
          <strong>Note:</strong> Permission roles are system-defined and cannot be modified.
          User roles can be changed from the Users page.
        </p>
      </div>
    </div>
  );
}
