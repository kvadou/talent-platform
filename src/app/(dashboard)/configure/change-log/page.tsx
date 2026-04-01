'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const CHANGES = [
  { id: '1', user: 'Admin User', action: 'Updated job posting', target: 'Senior Chess Instructor', timestamp: '2 hours ago', type: 'update' },
  { id: '2', user: 'Sarah Johnson', action: 'Created new job', target: 'Marketing Manager', timestamp: '5 hours ago', type: 'create' },
  { id: '3', user: 'Mike Smith', action: 'Moved candidate', target: 'John Doe to Interview stage', timestamp: '1 day ago', type: 'update' },
  { id: '4', user: 'Admin User', action: 'Deleted job posting', target: 'Intern Position', timestamp: '2 days ago', type: 'delete' },
  { id: '5', user: 'Sarah Johnson', action: 'Updated email template', target: 'Interview Confirmation', timestamp: '3 days ago', type: 'update' },
];

export default function ChangeLogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Change Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          View changes made to your organization
        </p>
      </div>

      <Card>
        <CardHeader title="Recent Changes" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {CHANGES.map((change) => (
              <div key={change.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{change.user}</span>
                    <span className="text-gray-500">{change.action}</span>
                    <Badge
                      variant={
                        change.type === 'create' ? 'success' :
                        change.type === 'delete' ? 'error' : 'neutral'
                      }
                    >
                      {change.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{change.target}</p>
                  <p className="text-xs text-gray-400 mt-1">{change.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
