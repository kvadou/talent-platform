'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const TEMPLATES = [
  { id: '1', name: 'LinkedIn Job Post', platform: 'LinkedIn', lastUsed: '2 days ago' },
  { id: '2', name: 'Twitter Announcement', platform: 'Twitter', lastUsed: '1 week ago' },
  { id: '3', name: 'Facebook Careers', platform: 'Facebook', lastUsed: '3 days ago' },
];

export default function SocialTemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Social Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your social media templates
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Card>
        <CardHeader title="Templates" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {TEMPLATES.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <span className="font-medium text-gray-900">{template.name}</span>
                  <p className="text-sm text-gray-500">{template.platform} • Last used {template.lastUsed}</p>
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
