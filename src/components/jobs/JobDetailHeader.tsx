'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { JobStatus, EmploymentType } from '@prisma/client';

type Job = {
  id: string;
  title: string;
  status: JobStatus;
  employmentType: EmploymentType;
  location: string | null;
  market: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  } | null;
  office?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    applications: number;
    openings: number;
  };
};

type Props = {
  job: Job;
};

const statusColors: Record<JobStatus, { variant: 'success' | 'warning' | 'neutral' | 'error'; label: string }> = {
  DRAFT: { variant: 'neutral', label: 'Draft' },
  PUBLISHED: { variant: 'success', label: 'Open' },
  CLOSED: { variant: 'error', label: 'Closed' },
  ARCHIVED: { variant: 'neutral', label: 'Archived' },
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  TEMPORARY: 'Temporary',
};

export function JobDetailHeader({ job }: Props) {
  const router = useRouter();
  const statusConfig = statusColors[job.status];

  const applyUrl = `/careers/${job.id}`;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Breadcrumb */}
      <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-100">
        <nav className="flex items-center text-sm text-gray-500">
          <Link href="/jobs" className="hover:text-brand-purple transition-colors">
            Jobs
          </Link>
          <ChevronRightIcon className="w-4 h-4 mx-1 sm:mx-2 text-gray-400 flex-shrink-0" />
          <span className="text-gray-900 font-medium truncate">
            {job.title}
          </span>
        </nav>
      </div>

      {/* Main Header */}
      <div className="px-3 sm:px-6 py-3 sm:py-4">
        {/* Mobile: Stack vertically */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Job Info */}
          <div className="min-w-0 flex-1">
            {/* Title and Badge */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-lg sm:text-2xl font-semibold text-gray-900">
                {job.title}
              </h1>
              <Badge variant={statusConfig.variant}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* Meta info - simplified on mobile */}
            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
              <span className="font-medium text-brand-purple">{job.market.name}</span>

              {job.location && (
                <>
                  <span className="text-gray-300 hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{job.location}</span>
                </>
              )}

              <span className="text-gray-300">•</span>
              <span>{employmentTypeLabels[job.employmentType]}</span>

              {job._count && (
                <>
                  <span className="text-gray-300">•</span>
                  <span>{job._count.applications} candidates</span>
                </>
              )}
            </div>

            {/* Location on mobile - separate line */}
            {job.location && (
              <div className="sm:hidden text-xs text-gray-500 mt-1 truncate">
                {job.location}
              </div>
            )}
          </div>

          {/* Actions - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto pb-1 -mb-1">
            {job.status === 'PUBLISHED' && (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                <span>Preview</span>
              </a>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/jobs/${job.id}/setup/info`)}
              className="whitespace-nowrap text-xs sm:text-sm"
            >
              <PencilIcon className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </Button>

            <Button
              size="sm"
              className="whitespace-nowrap text-xs sm:text-sm"
              onClick={() => router.push(`/candidates/new?jobId=${job.id}`)}
            >
              <PlusIcon className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add Candidate</span>
            </Button>

            <button
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="More options"
            >
              <EllipsisHorizontalIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
