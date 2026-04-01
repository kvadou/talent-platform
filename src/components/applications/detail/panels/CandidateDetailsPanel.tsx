'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DocumentTextIcon, ArrowTopRightOnSquareIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/Badge';

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  timezone: string | null;
  tags: string[];
};

const TIMEZONE_OPTIONS = [
  { value: '', label: 'Auto-detect (default ET)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
];

type Props = {
  candidate: Candidate;
  onTimezoneUpdate?: (timezone: string | null) => void;
};

export function CandidateDetailsPanel({ candidate, onTimezoneUpdate }: Props) {
  const [selectedTimezone, setSelectedTimezone] = useState(candidate.timezone || '');
  const fullName = `${candidate.firstName} ${candidate.lastName}`;
  const address = [candidate.street, candidate.city, candidate.state, candidate.country, candidate.postcode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          <Link href={`/candidates/${candidate.id}`} className="hover:text-brand-purple">
            {fullName}&apos;s details
          </Link>
        </h3>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Name</p>
          <Link href={`/candidates/${candidate.id}`} className="text-sm text-brand-purple hover:underline">
            {fullName}
          </Link>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Email address</p>
          <a href={`mailto:${candidate.email}`} className="text-sm text-brand-purple hover:underline">
            {candidate.email}
          </a>
          <span className="text-xs text-gray-400 ml-2">(Personal)</span>
        </div>

        {candidate.phone && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone number</p>
            <a href={`tel:${candidate.phone}`} className="text-sm text-brand-purple hover:underline">
              {candidate.phone}
            </a>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 mb-1">Timezone</p>
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={selectedTimezone}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedTimezone(value);
                onTimezoneUpdate?.(value || null);
              }}
              className="text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {candidate.linkedinUrl && (
          <div>
            <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
            <a
              href={candidate.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-purple hover:underline inline-flex items-center gap-1"
            >
              View Profile
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </a>
          </div>
        )}

        {candidate.portfolioUrl && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Portfolio</p>
            <a
              href={candidate.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-purple hover:underline inline-flex items-center gap-1"
            >
              View Portfolio
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Resume */}
      {candidate.resumeUrl && (
        <div className="border-t border-gray-100 pt-4">
          <a
            href={candidate.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
            <span className="flex-1 text-sm font-medium text-gray-900">Resume</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button className="w-full text-left text-sm text-brand-purple hover:underline">
          + Add education
        </button>
        <button className="w-full text-left text-sm text-brand-purple hover:underline">
          + Add address
        </button>
      </div>

      {/* Additional Details */}
      <div className="border-t border-gray-100 pt-4">
        <button className="flex items-center justify-between w-full text-left">
          <h4 className="font-medium text-gray-900">Additional details</h4>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Tags */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Candidate tags</p>
          {candidate.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {candidate.tags.map((tag) => (
                <Badge key={tag} variant="neutral" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">--</p>
          )}
        </div>

        {/* Address */}
        {address && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Address</p>
            <p className="text-sm text-gray-900">{address}</p>
          </div>
        )}
      </div>
    </div>
  );
}
