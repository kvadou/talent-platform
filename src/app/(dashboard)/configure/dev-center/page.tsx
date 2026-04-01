'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { KeyIcon, LinkIcon } from '@heroicons/react/24/outline';

export default function DevCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dev Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          API keys, webhooks, and development resources
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/configure/dev-center/api-keys">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <KeyIcon className="w-8 h-8 text-brand-purple" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">API Keys</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage API keys for integrations
                  </p>
                  <p className="text-xs text-brand-purple mt-2">2 active keys</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configure/dev-center/webhooks">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-cyan-50 rounded-lg">
                  <LinkIcon className="w-8 h-8 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Webhooks</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure webhook endpoints
                  </p>
                  <p className="text-xs text-cyan-600 mt-2">3 webhooks configured</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
