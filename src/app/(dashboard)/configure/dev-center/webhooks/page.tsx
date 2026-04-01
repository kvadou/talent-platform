'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, LinkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const WEBHOOKS = [
  { id: '1', url: 'https://api.example.com/webhooks/ats', events: ['application.created', 'application.updated'], status: 'Active' },
  { id: '2', url: 'https://slack.com/webhooks/hiring', events: ['offer.accepted'], status: 'Active' },
  { id: '3', url: 'https://internal.company.com/hr', events: ['hire.completed'], status: 'Failing' },
];

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure webhook endpoints for real-time notifications
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      <Card>
        <CardHeader title="Configured Webhooks" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {WEBHOOKS.map((webhook) => (
              <div key={webhook.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-cyan-50 rounded-lg">
                    <LinkIcon className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-900">{webhook.url}</span>
                      <Badge variant={webhook.status === 'Active' ? 'success' : 'error'}>
                        {webhook.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Events: {webhook.events.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg">
                    <PencilIcon className="w-4 h-4" />
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
    </div>
  );
}
