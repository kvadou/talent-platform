'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface BackgroundCheck {
  id: string;
  package: string;
  status: string;
  result: string | null;
  adjudication: string | null;
  reportUrl: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Package {
  slug: string;
  name: string;
  description: string;
}

interface BackgroundCheckSectionProps {
  candidateId: string;
  candidateName: string;
}

export function BackgroundCheckSection({ candidateId, candidateName }: BackgroundCheckSectionProps) {
  const [checks, setChecks] = useState<BackgroundCheck[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch background checks and packages
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [checksRes, packagesRes] = await Promise.all([
          fetch(`/api/integrations/checkr?candidateId=${candidateId}`),
          fetch('/api/integrations/checkr?action=packages'),
        ]);

        if (checksRes.ok) {
          const data = await checksRes.json();
          setChecks(data.backgroundChecks || []);
        }

        if (packagesRes.ok) {
          const data = await packagesRes.json();
          setPackages(data.packages || []);
          setIsConfigured(data.configured);
          if (data.packages?.length > 0) {
            setSelectedPackage(data.packages[0].slug);
          }
        }
      } catch (e) {
        console.error('Failed to fetch background check data:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [candidateId]);

  const handleInitiateCheck = async () => {
    if (!selectedPackage) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/integrations/checkr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          package: selectedPackage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate background check');
      }

      // Add new check to list
      setChecks((prev) => [data.backgroundCheck, ...prev]);
      setShowModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initiate check');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (check: BackgroundCheck) => {
    const status = check.status;
    const result = check.result;

    if (status === 'complete') {
      if (result === 'clear') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Clear
          </span>
        );
      } else if (result === 'consider') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Review Required
          </span>
        );
      }
    }

    // Invitation flow statuses
    if (status === 'invitation_pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
          <ClockIcon className="h-3.5 w-3.5" />
          Awaiting Candidate
        </span>
      );
    }

    if (status === 'invitation_expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
          Invitation Expired
        </span>
      );
    }

    if (status === 'pending' || status === 'processing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
          <ClockIcon className="h-3.5 w-3.5" />
          In Progress
        </span>
      );
    }

    if (status === 'suspended' || status === 'canceled') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <XCircleIcon className="h-3.5 w-3.5" />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {status}
      </span>
    );
  };

  const hasPendingCheck = checks.some(
    (c) => c.status === 'pending' || c.status === 'processing' || c.status === 'invitation_pending'
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 w-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Background Check</h3>
            <p className="text-sm text-gray-500">
              {checks.length === 0
                ? 'No checks initiated'
                : `${checks.length} check${checks.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
          disabled={!isConfigured || hasPendingCheck}
        >
          {hasPendingCheck ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
              In Progress
            </>
          ) : (
            'Start Check'
          )}
        </Button>
      </div>

      {!isConfigured && (
        <div className="text-sm text-warning-600 bg-warning-50 px-3 py-2 rounded-lg mb-4">
          Checkr integration not configured. Add CHECKR_API_KEY to enable.
        </div>
      )}

      {/* List of checks */}
      {checks.length > 0 && (
        <div className="space-y-3">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between py-2 border-t border-gray-100"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {check.package.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  {getStatusBadge(check)}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Started {new Date(check.createdAt).toLocaleDateString()}
                  {check.completedAt &&
                    ` • Completed ${new Date(check.completedAt).toLocaleDateString()}`}
                </p>
              </div>
              {check.reportUrl && (
                <a
                  href={check.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:text-purple-800"
                >
                  View Report
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Initiate Check Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`Start Background Check for ${candidateName}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Package
            </label>
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              {packages.map((pkg) => (
                <option key={pkg.slug} value={pkg.slug}>
                  {pkg.name} - {pkg.description}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">What happens next:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Candidate receives an email from Checkr</li>
              <li>They fill out their information (DOB, SSN, address)</li>
              <li>Background check runs once they complete the form</li>
              <li>Results typically arrive within 1-5 business days</li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => setShowModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleInitiateCheck} loading={submitting}>
            {submitting ? 'Initiating...' : 'Start Background Check'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Compact badge for use in candidate lists
export function BackgroundCheckBadge({ status, result }: { status: string; result: string | null }) {
  if (status === 'complete' && result === 'clear') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-success-100 text-success-700" title="Background check cleared">
        <CheckCircleIcon className="h-3 w-3" />
      </span>
    );
  }

  if (status === 'complete' && result === 'consider') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-700" title="Background check requires review">
        <ExclamationTriangleIcon className="h-3 w-3" />
      </span>
    );
  }

  if (status === 'invitation_pending') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700" title="Awaiting candidate response">
        <ClockIcon className="h-3 w-3" />
      </span>
    );
  }

  if (status === 'invitation_expired') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-700" title="Background check invitation expired">
        <ExclamationTriangleIcon className="h-3 w-3" />
      </span>
    );
  }

  if (status === 'pending' || status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700" title="Background check in progress">
        <ClockIcon className="h-3 w-3" />
      </span>
    );
  }

  return null;
}
