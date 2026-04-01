'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type BackgroundCheck = {
  id: string;
  package: string;
  status: string;
  result: string | null;
  adjudication: string | null;
  reportUrl: string | null;
  completedAt: string | null;
  createdAt: string;
};

type Package = {
  slug: string;
  name: string;
  description: string;
};

type Props = {
  candidateId: string;
  candidateName: string;
};

export function BackgroundCheckSection({ candidateId, candidateName }: Props) {
  const [backgroundChecks, setBackgroundChecks] = useState<BackgroundCheck[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [workCity, setWorkCity] = useState('');
  const [workState, setWorkState] = useState('');
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState('');

  // Fetch background checks and packages
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch packages configuration
        const packagesRes = await fetch('/api/integrations/checkr?action=packages');
        if (packagesRes.ok) {
          const packagesData = await packagesRes.json();
          setIsConfigured(packagesData.configured);
          setPackages(packagesData.packages || []);
          if (packagesData.packages?.length > 0) {
            setSelectedPackage(packagesData.packages[0].slug);
          }
        }

        // Fetch existing background checks for this candidate
        const checksRes = await fetch(`/api/integrations/checkr?candidateId=${candidateId}`);
        if (checksRes.ok) {
          const checksData = await checksRes.json();
          setBackgroundChecks(checksData.backgroundChecks || []);
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
    if (!selectedPackage || !workState) return;

    setInitiating(true);
    setError('');

    try {
      const res = await fetch('/api/integrations/checkr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          package: selectedPackage,
          workLocation: {
            city: workCity || undefined,
            state: workState,
            country: 'US',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate background check');
      }

      // Add the new check to the list
      setBackgroundChecks([data.backgroundCheck, ...backgroundChecks]);
      setIsModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initiate background check');
    } finally {
      setInitiating(false);
    }
  };

  const getStatusBadge = (check: BackgroundCheck) => {
    const { status, result } = check;

    if (status === 'complete') {
      if (result === 'clear') {
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Clear
          </Badge>
        );
      }
      if (result === 'consider') {
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Review Required
          </Badge>
        );
      }
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Complete
        </Badge>
      );
    }

    // Invitation flow statuses
    if (status === 'invitation_pending') {
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          Awaiting Candidate
        </Badge>
      );
    }

    if (status === 'invitation_expired') {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
          Invitation Expired
        </Badge>
      );
    }

    if (status === 'pending' || status === 'processing') {
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          {status === 'pending' ? 'Pending' : 'Processing'}
        </Badge>
      );
    }

    if (status === 'suspended' || status === 'canceled') {
      return (
        <Badge variant="error" className="flex items-center gap-1">
          <XCircleIcon className="h-3.5 w-3.5" />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    }

    return <Badge variant="neutral">{status}</Badge>;
  };

  const formatPackageName = (slug: string) => {
    const pkg = packages.find((p) => p.slug === slug);
    return pkg?.name || slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const hasPendingCheck = backgroundChecks.some(
    (c) => c.status === 'pending' || c.status === 'processing' || c.status === 'invitation_pending'
  );

  const latestCheck = backgroundChecks[0];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-16 bg-gray-100 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-gray-500" />
              Background Check
            </h3>
            {isConfigured && !hasPendingCheck && (
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                {backgroundChecks.length > 0 ? 'Run New Check' : 'Initiate Check'}
              </Button>
            )}
          </div>

          {!isConfigured ? (
            <div className="bg-warning-50 border border-warning-100 rounded-lg p-4">
              <p className="text-sm text-warning-700">
                Background checks are not configured. Add <code className="bg-warning-100 px-1 rounded">CHECKR_API_KEY</code> to enable Checkr integration.
              </p>
            </div>
          ) : backgroundChecks.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
              <ShieldCheckIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No background check has been initiated yet.</p>
              <p className="text-xs text-gray-500 mt-1">
                Run a background check before extending an offer.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backgroundChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatPackageName(check.package)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Started {new Date(check.createdAt).toLocaleDateString()}
                      {check.completedAt && (
                        <> · Completed {new Date(check.completedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(check)}
                    {check.reportUrl && (
                      <a
                        href={check.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 hover:underline"
                      >
                        View Report
                      </a>
                    )}
                  </div>
                </div>
              ))}

              {/* Status message for hiring decision */}
              {latestCheck && latestCheck.status === 'invitation_pending' && (
                <div className="mt-4 p-3 rounded-lg border bg-cyan-50 border-cyan-100">
                  <p className="text-sm font-medium text-cyan-700">
                    Waiting for candidate to complete the background check form.
                  </p>
                  <p className="text-xs text-cyan-600 mt-1">
                    An email was sent to the candidate from Checkr to collect their information.
                  </p>
                </div>
              )}

              {latestCheck && latestCheck.status === 'invitation_expired' && (
                <div className="mt-4 p-3 rounded-lg border bg-warning-50 border-warning-100">
                  <p className="text-sm font-medium text-warning-700">
                    The invitation expired. You can send a new background check request.
                  </p>
                </div>
              )}

              {latestCheck && latestCheck.status === 'complete' && (
                <div
                  className={`mt-4 p-3 rounded-lg border ${
                    latestCheck.result === 'clear'
                      ? 'bg-success-50 border-success-100'
                      : 'bg-warning-50 border-warning-100'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      latestCheck.result === 'clear' ? 'text-success-700' : 'text-warning-700'
                    }`}
                  >
                    {latestCheck.result === 'clear'
                      ? 'Background check cleared. Ready to proceed with offer.'
                      : 'Background check requires review before proceeding.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Initiate Background Check Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate Background Check"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Location <span className="text-danger-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="City"
                value={workCity}
                onChange={(e) => setWorkCity(e.target.value)}
                className="rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <select
                value={workState}
                onChange={(e) => setWorkState(e.target.value)}
                className="rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="">Select State</option>
                <option value="AL">Alabama</option>
                <option value="AK">Alaska</option>
                <option value="AZ">Arizona</option>
                <option value="AR">Arkansas</option>
                <option value="CA">California</option>
                <option value="CO">Colorado</option>
                <option value="CT">Connecticut</option>
                <option value="DE">Delaware</option>
                <option value="FL">Florida</option>
                <option value="GA">Georgia</option>
                <option value="HI">Hawaii</option>
                <option value="ID">Idaho</option>
                <option value="IL">Illinois</option>
                <option value="IN">Indiana</option>
                <option value="IA">Iowa</option>
                <option value="KS">Kansas</option>
                <option value="KY">Kentucky</option>
                <option value="LA">Louisiana</option>
                <option value="ME">Maine</option>
                <option value="MD">Maryland</option>
                <option value="MA">Massachusetts</option>
                <option value="MI">Michigan</option>
                <option value="MN">Minnesota</option>
                <option value="MS">Mississippi</option>
                <option value="MO">Missouri</option>
                <option value="MT">Montana</option>
                <option value="NE">Nebraska</option>
                <option value="NV">Nevada</option>
                <option value="NH">New Hampshire</option>
                <option value="NJ">New Jersey</option>
                <option value="NM">New Mexico</option>
                <option value="NY">New York</option>
                <option value="NC">North Carolina</option>
                <option value="ND">North Dakota</option>
                <option value="OH">Ohio</option>
                <option value="OK">Oklahoma</option>
                <option value="OR">Oregon</option>
                <option value="PA">Pennsylvania</option>
                <option value="RI">Rhode Island</option>
                <option value="SC">South Carolina</option>
                <option value="SD">South Dakota</option>
                <option value="TN">Tennessee</option>
                <option value="TX">Texas</option>
                <option value="UT">Utah</option>
                <option value="VT">Vermont</option>
                <option value="VA">Virginia</option>
                <option value="WA">Washington</option>
                <option value="WV">West Virginia</option>
                <option value="WI">Wisconsin</option>
                <option value="WY">Wyoming</option>
                <option value="DC">Washington DC</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Check Package <span className="text-danger-500">*</span>
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

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Running check for:</p>
                <p>{candidateName}</p>
                <p className="text-xs text-gray-500 mt-2">
                  The candidate will receive an email from Checkr to authorize the background check.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={initiating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInitiateCheck}
            loading={initiating}
            disabled={!selectedPackage || !workState}
          >
            {initiating ? 'Initiating...' : 'Start Background Check'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
