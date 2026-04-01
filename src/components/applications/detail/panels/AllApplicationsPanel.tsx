'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

type Application = {
  id: string;
  status: string;
  createdAt: string;
  job: { id: string; title: string; market: { name: string } };
  stage: { name: string };
};

type Props = {
  currentApplicationId: string;
  applications: Application[];
};

export function AllApplicationsPanel({ currentApplicationId, applications }: Props) {
  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'HIRED':
        return 'info';
      case 'REJECTED':
        return 'error';
      case 'WITHDRAWN':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">All jobs & applications</h3>

      {applications.length === 0 ? (
        <p className="text-sm text-gray-500">No applications found</p>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const isCurrentApplication = app.id === currentApplicationId;

            return (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className={`block p-3 rounded-lg border transition-colors ${
                  isCurrentApplication
                    ? 'border-brand-purple bg-brand-purple/5'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {app.job.title} - {app.job.market.name}
                    </p>
                  </div>
                  {isCurrentApplication && (
                    <Badge variant="info" className="text-xs flex-shrink-0">
                      Viewing now
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getStatusVariant(app.status)} className="text-xs">
                    {app.status}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Stage: {app.stage.name}
                  </span>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  Applied: {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
