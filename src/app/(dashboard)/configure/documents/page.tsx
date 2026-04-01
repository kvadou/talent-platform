'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { DocumentTextIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure offer templates and e-signature agreements
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/configure/documents/offers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <DocumentTextIcon className="w-8 h-8 text-brand-purple" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Offer Templates</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Create and manage offer letter templates
                  </p>
                  <p className="text-xs text-brand-purple mt-2">3 templates</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configure/documents/esignatures">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-cyan-50 rounded-lg">
                  <PencilSquareIcon className="w-8 h-8 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">E-Signatures</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage e-signature agreements and templates
                  </p>
                  <p className="text-xs text-cyan-600 mt-2">5 documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
