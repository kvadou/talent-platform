'use client';
import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import Link from 'next/link';
import { ApplicationCard, ApplicationCardData } from './ApplicationCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ClockIcon, ExclamationTriangleIcon, ChevronDownIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

type AccentColor = 'purple' | 'cyan' | 'yellow';

const accentStyles: Record<AccentColor, {
  border: string;
  borderHover: string;
  bg: string;
  bgHover: string;
  text: string;
  badge: string;
  ring: string;
  gradient: string;
}> = {
  purple: {
    border: 'border-purple-200/60',
    borderHover: 'hover:border-purple-300',
    bg: 'bg-purple-50/30',
    bgHover: 'hover:bg-purple-50/50',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    ring: 'ring-purple-400/50',
    gradient: 'from-purple-500/5 to-transparent'
  },
  cyan: {
    border: 'border-cyan-200/60',
    borderHover: 'hover:border-cyan-300',
    bg: 'bg-cyan-50/30',
    bgHover: 'hover:bg-cyan-50/50',
    text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    ring: 'ring-cyan-400/50',
    gradient: 'from-cyan-500/5 to-transparent'
  },
  yellow: {
    border: 'border-yellow-200/60',
    borderHover: 'hover:border-yellow-300',
    bg: 'bg-yellow-50/30',
    bgHover: 'hover:bg-yellow-50/50',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    ring: 'ring-yellow-400/50',
    gradient: 'from-yellow-400/5 to-transparent'
  }
};

const PAGE_SIZE = 25;

export function StageColumn({
  id,
  name,
  applications,
  metrics,
  accentColor = 'purple',
  jobId,
  bulkMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: {
  id: string;
  name: string;
  applications: ApplicationCardData[];
  metrics?: {
    count: number;
    avgDaysInStage?: number;
    slaBreaches?: number;
  };
  accentColor?: AccentColor;
  jobId: string;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (appId: string) => void;
  onSelectAll?: (appIds: string[]) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasBreaches = metrics?.slaBreaches && metrics.slaBreaches > 0;
  const styles = accentStyles[accentColor];

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const totalCount = applications.length;
  const visibleApplications = applications.slice(0, visibleCount);
  const hasMore = visibleCount < totalCount;
  const remainingCount = totalCount - visibleCount;

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-white rounded-xl p-4 border-2
        ${styles.border} ${styles.borderHover}
        space-y-4 min-h-[400px]
        transition-all duration-300 ease-out-expo
        ${isOver ? `ring-4 ${styles.ring} scale-[1.02] shadow-xl` : 'shadow-sm'}
        relative overflow-hidden
      `}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} pointer-events-none`} />

      {/* Column Header */}
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-display font-bold ${styles.text} tracking-tight`}>
              {name}
            </h3>
            {hasBreaches && (
              <Badge variant="error" size="sm" className="flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {metrics.slaBreaches}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`
              ${styles.badge}
              px-2.5 py-1 rounded-full
              text-sm font-bold
              shadow-sm
            `}>
              {applications.length}
            </div>
            {bulkMode && onSelectAll && applications.length > 0 && (
              <button
                onClick={() => onSelectAll(applications.map(a => a.id))}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                {applications.every(a => selectedIds?.has(a.id)) ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
        </div>

        {/* Metrics Row */}
        {metrics?.avgDaysInStage !== undefined && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ClockIcon className="h-3.5 w-3.5" />
            <span className="font-medium">
              {metrics.avgDaysInStage.toFixed(0)} days avg
            </span>
          </div>
        )}
      </div>

      {/* Applications List */}
      <div className="space-y-3 relative z-10">
        {/* Showing count indicator */}
        {totalCount > PAGE_SIZE && (
          <div className="text-xs text-slate-500 text-center pb-1">
            Showing {Math.min(visibleCount, totalCount)} of {totalCount.toLocaleString()}
          </div>
        )}

        {visibleApplications.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            bulkMode={bulkMode}
            isSelected={selectedIds?.has(app.id) || false}
            onToggleSelect={onToggleSelect}
          />
        ))}

        {/* Load More / View All */}
        {hasMore && (
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              icon={<ChevronDownIcon className="h-4 w-4" />}
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Load {Math.min(PAGE_SIZE, remainingCount)} more
            </Button>
            <Link
              href={`/jobs/${jobId}/candidates?stageId=${id}`}
              className={`
                flex items-center justify-center gap-1.5 w-full
                text-xs font-medium ${styles.text}
                hover:underline py-1.5
              `}
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              View all {totalCount.toLocaleString()} in list
            </Link>
          </div>
        )}

        {/* Empty State */}
        {applications.length === 0 && (
          <div className={`
            text-xs text-slate-500 text-center py-8
            border-2 border-dashed rounded-lg
            ${styles.border}
            ${styles.bg}
            transition-colors duration-300
          `}>
            <p className="font-medium">Drop candidates here</p>
          </div>
        )}
      </div>
    </div>
  );
}
