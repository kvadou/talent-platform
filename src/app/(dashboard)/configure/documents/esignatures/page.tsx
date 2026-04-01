'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PlusIcon, PencilIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

const DOCUMENTS = [
  { id: '1', name: 'NDA Agreement', signers: 1, status: 'Active' },
  { id: '2', name: 'Employment Contract', signers: 2, status: 'Active' },
  { id: '3', name: 'I-9 Form', signers: 1, status: 'Active' },
  { id: '4', name: 'W-4 Form', signers: 1, status: 'Active' },
  { id: '5', name: 'Direct Deposit Authorization', signers: 1, status: 'Draft' },
];

export default function ESignaturesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">E-Signatures</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage e-signature agreements and templates
          </p>
        </div>
        <Button>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Document
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {DOCUMENTS.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-cyan-50 rounded-lg">
                    <PencilSquareIcon className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{doc.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{doc.signers} signer(s)</span>
                      <Badge variant={doc.status === 'Active' ? 'success' : 'warning'}>{doc.status}</Badge>
                    </div>
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
