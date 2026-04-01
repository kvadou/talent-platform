'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, DocumentCheckIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const PACKETS = [
  { id: '1', name: 'New Hire Onboarding', documents: 5, lastUsed: '2 days ago', status: 'Active' },
  { id: '2', name: 'Background Check Authorization', documents: 2, lastUsed: '1 week ago', status: 'Active' },
  { id: '3', name: 'Contractor Agreement', documents: 3, lastUsed: '3 days ago', status: 'Active' },
];

export default function CandidatePacketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Candidate Packets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create application packets for candidates
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Packet
        </Button>
      </div>

      <Card>
        <CardHeader title="Document Packets" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {PACKETS.map((packet) => (
              <div key={packet.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <DocumentCheckIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{packet.name}</span>
                      <Badge variant="success">{packet.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {packet.documents} documents • Last used {packet.lastUsed}
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
