'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, KeyIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const API_KEYS = [
  { id: '1', name: 'Production API Key', prefix: 'sk_live_****', created: 'Dec 1, 2024', lastUsed: '2 hours ago' },
  { id: '2', name: 'Development Key', prefix: 'sk_test_****', created: 'Nov 15, 2024', lastUsed: '5 days ago' },
];

export default function APIKeysPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage API keys for integrations
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Key
        </Button>
      </div>

      <Card>
        <CardHeader title="Active Keys" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {API_KEYS.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <KeyIcon className="w-5 h-5 text-brand-purple" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{key.name}</span>
                    <p className="text-sm font-mono text-gray-500">{key.prefix}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created {key.created} • Last used {key.lastUsed}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="API Documentation" />
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Use the API to integrate with your existing tools and workflows.
          </p>
          <Button variant="outline">View Documentation</Button>
        </CardContent>
      </Card>
    </div>
  );
}
