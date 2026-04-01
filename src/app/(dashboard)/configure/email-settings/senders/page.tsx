'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const SENDERS = [
  { id: '1', name: 'Recruiting Team', email: 'recruiting@acmetalent.com', isDefault: true },
  { id: '2', name: 'HR Team', email: 'hr@acmetalent.com', isDefault: false },
  { id: '3', name: 'Careers', email: 'careers@acmetalent.com', isDefault: false },
];

export default function SenderProfilesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sender Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage email sender identities
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Sender
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {SENDERS.map((sender) => (
              <div key={sender.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{sender.name}</span>
                    {sender.isDefault && <Badge variant="success">Default</Badge>}
                  </div>
                  <p className="text-sm text-gray-500">{sender.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  {!sender.isDefault && (
                    <button className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
