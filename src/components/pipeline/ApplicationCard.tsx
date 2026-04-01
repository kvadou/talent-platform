'use client';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { EnvelopeIcon, Bars3Icon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export type ApplicationCardData = {
  id: string;
  candidate: { firstName: string; lastName: string; email: string };
  status: string;
  matchScore?: number | null;
  daysInStage?: number;
  needsDecision?: boolean;
};

export function ApplicationCard({
  app,
  bulkMode,
  isSelected,
  onToggleSelect,
}: {
  app: ApplicationCardData;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (appId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(bulkMode ? {} : { ...listeners, ...attributes })}
      onClick={bulkMode ? () => onToggleSelect?.(app.id) : undefined}
      className={`
        bg-white border-2 border-slate-200/60 rounded-lg shadow-sm p-4
        hover:shadow-lg hover:border-purple-200/60 hover:-translate-y-0.5
        transition-all duration-300 ease-out-expo
        ${bulkMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        group relative
        ${isDragging ? 'opacity-50 shadow-2xl scale-105 rotate-2 z-50' : ''}
        ${bulkMode ? 'pl-10' : ''}
        ${isSelected ? 'ring-2 ring-purple-500 border-purple-300 bg-purple-50/30' : ''}
      `}
    >
      {/* Bulk Select Checkbox */}
      {bulkMode && (
        <div
          className="absolute top-3 left-3 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(app.id);
          }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-purple-600 border-purple-600'
              : 'border-slate-300 hover:border-purple-400'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}
      {/* Drag Handle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Bars3Icon className="h-4 w-4 text-slate-400" />
      </div>

      {/* Candidate Name */}
      <Link
        href={`/applications/${app.id}`}
        className="block mb-2 group/link"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-display font-bold text-navy-900 group-hover/link:text-purple-700 transition-colors">
          {app.candidate.firstName} {app.candidate.lastName}
        </h4>
      </Link>

      {/* Candidate Email */}
      <div className="flex items-center gap-2 mb-2">
        <EnvelopeIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-600 truncate">{app.candidate.email}</p>
      </div>

      {/* Badges Row: Days in Stage + Needs Decision */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {app.daysInStage != null && app.daysInStage > 0 && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
              app.daysInStage >= 7
                ? 'bg-danger-100 text-danger-700'
                : app.daysInStage >= 3
                ? 'bg-warning-100 text-warning-700'
                : 'bg-slate-100 text-slate-600'
            }`}
            title={`${app.daysInStage} day${app.daysInStage === 1 ? '' : 's'} in stage`}
          >
            <ClockIcon className="h-3 w-3" />
            {app.daysInStage}d
          </span>
        )}
        {app.needsDecision && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
            title="Needs decision - interview completed, awaiting scorecard"
          >
            <ExclamationCircleIcon className="h-3 w-3" />
            Decision
          </span>
        )}
      </div>

      {/* Status Badge and Match Score */}
      <div className="flex items-center justify-between">
        <StatusBadge
          status={app.status === 'ACTIVE' ? 'published' : app.status === 'REJECTED' ? 'archived' : 'draft'}
        />
        {app.matchScore != null && (
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
              app.matchScore >= 70
                ? 'bg-success-100 text-success-700'
                : app.matchScore >= 40
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {app.matchScore}%
          </span>
        )}
      </div>

      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-cyan-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 rounded-lg transition-all duration-300 pointer-events-none" />
    </div>
  );
}
