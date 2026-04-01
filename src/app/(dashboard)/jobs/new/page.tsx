'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarIcon,
  DocumentTextIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';

type Market = { id: string; name: string };
type Department = { id: string; name: string };
type Office = { id: string; name: string };

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'TEMPORARY', label: 'Temporary' },
];

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data for dropdowns
  const [markets, setMarkets] = useState<Market[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [title, setTitle] = useState('');
  const [internalJobName, setInternalJobName] = useState('');
  const [description, setDescription] = useState('');
  const [marketId, setMarketId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [requisitionId, setRequisitionId] = useState('');
  const [openDate, setOpenDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('DRAFT');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [jobsRes, deptsRes, officesRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/departments'),
        fetch('/api/offices'),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setMarkets(data.markets || []);
        // Auto-select first market if only one
        if (data.markets?.length === 1) {
          setMarketId(data.markets[0].id);
        }
      }

      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(data.departments || []);
      }

      if (officesRes.ok) {
        const data = await officesRes.json();
        setOffices(data.offices || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !marketId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          internalJobName: internalJobName.trim() || null,
          description: description.trim() || null,
          marketId,
          departmentId: departmentId || null,
          officeId: officeId || null,
          location: location.trim() || null,
          employmentType,
          requisitionId: requisitionId.trim() || null,
          openDate,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create job');
      }

      const job = await res.json();
      router.push(`/jobs/${job.id}/setup`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/jobs"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create a Job</h1>
          <p className="text-sm text-gray-500">
            Set up a new position for your team
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Info */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <BriefcaseIcon className="w-4 h-4" />
              Job Info
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-danger-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Senior Chess Instructor"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the public-facing title candidates will see
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Job Name
              </label>
              <Input
                value={internalJobName}
                onChange={(e) => setInternalJobName(e.target.value)}
                placeholder="e.g. Chess Instructor - NYC Q1 2025"
              />
              <p className="text-xs text-gray-500 mt-1">
                Internal reference name (optional, only visible to your team)
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Market <span className="text-danger-500">*</span>
                </label>
                <Select
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  required
                >
                  <option value="">Select a market...</option>
                  {markets.map((market) => (
                    <option key={market.id} value={market.id}>
                      {market.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <Select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">Select a department...</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Office
                </label>
                <Select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                >
                  <option value="">Select an office...</option>
                  {offices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Type
                </label>
                <Select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Details */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPinIcon className="w-4 h-4" />
              Location & Details
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New York, NY or Remote"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requisition ID
                </label>
                <div className="flex gap-2">
                  <Input
                    value={requisitionId}
                    onChange={(e) => setRequisitionId(e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to auto-generate
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Open Date
                </label>
                <Input
                  type="date"
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-4 h-4" />
              Job Description
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                placeholder="Describe the role, responsibilities, and requirements..."
              />
              <p className="text-xs text-gray-500 mt-1">
                You can edit this later in Job Setup → Job Post
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <HashtagIcon className="w-4 h-4" />
              Publishing
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="DRAFT">Draft — Continue setting up before publishing</option>
                <option value="OPEN">Open — Ready to accept applications</option>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Draft jobs are not visible on your career site
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-500">
            After creating, you can configure the hiring team, interview plan, and scorecards.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/jobs">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saving || !title.trim() || !marketId}
            >
              {saving ? 'Creating...' : 'Create Job & Continue'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
