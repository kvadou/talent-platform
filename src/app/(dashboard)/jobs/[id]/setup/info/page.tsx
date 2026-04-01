'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Job = {
  id: string;
  title: string;
  internalJobName: string | null;
  description: string | null;
  location: string | null;
  requisitionId: string | null;
  status: string;
  employmentType: string;
  openDate: string;
  closeDate: string | null;
  departmentId: string | null;
  officeId: string | null;
  esignTemplateId: string | null;
  market: { id: string; name: string };
  department: { id: string; name: string } | null;
  office: { id: string; name: string } | null;
  openings: {
    id: string;
    openingId: string;
    status: string;
    openDate: string;
    targetStartDate: string | null;
    closeDate: string | null;
    closeReason: string | null;
    hiredApplication: {
      candidate: { firstName: string; lastName: string };
    } | null;
  }[];
};

type ESignTemplate = {
  id: string;
  title: string;
};

type Department = { id: string; name: string };
type Office = { id: string; name: string };

export default function JobInfoPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [esignTemplates, setEsignTemplates] = useState<ESignTemplate[]>([]);
  const [esignConfigured, setEsignConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteOpeningConfirm, setShowDeleteOpeningConfirm] = useState(false);
  const [pendingDeleteOpeningId, setPendingDeleteOpeningId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    internalJobName: '',
    description: '',
    location: '',
    requisitionId: '',
    status: 'DRAFT',
    employmentType: 'FULL_TIME',
    departmentId: '',
    officeId: '',
    esignTemplateId: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [jobRes, deptRes, officeRes, esignRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch('/api/departments'),
        fetch('/api/offices'),
        fetch('/api/integrations/esign?action=templates'),
      ]);

      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData);
        setFormData({
          title: jobData.title || '',
          internalJobName: jobData.internalJobName || '',
          description: jobData.description || '',
          location: jobData.location || '',
          requisitionId: jobData.requisitionId || '',
          status: jobData.status || 'DRAFT',
          employmentType: jobData.employmentType || 'FULL_TIME',
          departmentId: jobData.departmentId || '',
          officeId: jobData.officeId || '',
          esignTemplateId: jobData.esignTemplateId || '',
        });
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }

      if (officeRes.ok) {
        const officeData = await officeRes.json();
        setOffices(officeData.offices || []);
      }

      if (esignRes.ok) {
        const esignData = await esignRes.json();
        setEsignConfigured(esignData.configured);
        setEsignTemplates(esignData.templates || []);
      }
    } catch (err) {
      setError('Failed to load job data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      const updated = await res.json();
      setJob(updated);
      router.refresh();
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddOpening() {
    try {
      const res = await fetch(`/api/jobs/${jobId}/openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Failed to add opening');
    }
  }

  function initiateDeleteOpening(openingId: string) {
    setPendingDeleteOpeningId(openingId);
    setShowDeleteOpeningConfirm(true);
  }

  async function handleDeleteOpening(openingId: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}/openings/${openingId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      setError('Failed to delete opening');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  const openingStatusColors: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
    OPEN: 'success',
    PENDING: 'warning',
    FILLED: 'neutral',
    CLOSED: 'error',
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader
          title="Basic Information"
          action={
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          }
        />
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Job Name
              </label>
              <input
                type="text"
                value={formData.internalJobName}
                onChange={(e) =>
                  setFormData({ ...formData, internalJobName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="Internal reference name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requisition ID
              </label>
              <input
                type="text"
                value={formData.requisitionId}
                onChange={(e) =>
                  setFormData({ ...formData, requisitionId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="e.g., REQ-130"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) =>
                  setFormData({ ...formData, employmentType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="TEMPORARY">Temporary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="e.g., New York, NY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) =>
                  setFormData({ ...formData, departmentId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Office
              </label>
              <select
                value={formData.officeId}
                onChange={(e) => setFormData({ ...formData, officeId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="">Select office</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <RichTextEditor
                value={formData.description}
                onChange={(html) => setFormData({ ...formData, description: html })}
                placeholder="Enter job description..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offer Settings */}
      {esignConfigured && (
        <Card>
          <CardHeader
            title="Offer Settings"
            action={
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            }
          />
          <CardContent>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Offer Template (E-Sign)
              </label>
              <select
                value={formData.esignTemplateId}
                onChange={(e) =>
                  setFormData({ ...formData, esignTemplateId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="">Select a template...</option>
                {esignTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-2">
                This template will be pre-selected when sending offers for signature for this job.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Opening Confirmation */}
      <ConfirmModal
        open={showDeleteOpeningConfirm}
        onClose={() => { setShowDeleteOpeningConfirm(false); setPendingDeleteOpeningId(null); }}
        onConfirm={() => {
          setShowDeleteOpeningConfirm(false);
          if (pendingDeleteOpeningId) handleDeleteOpening(pendingDeleteOpeningId);
          setPendingDeleteOpeningId(null);
        }}
        title="Delete Opening"
        message="Are you sure you want to delete this opening?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Openings */}
      <Card>
        <CardHeader
          title="Openings"
          action={
            <Button variant="outline" size="sm" onClick={handleAddOpening}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Opening
            </Button>
          }
        />
        <CardContent>
          {job.openings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Open Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Target Start
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                      Hired
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {job.openings.map((opening) => (
                    <tr key={opening.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        #{opening.openingId}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={openingStatusColors[opening.status] || 'neutral'}>
                          {opening.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(opening.openDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {opening.targetStartDate
                          ? new Date(opening.targetStartDate).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {opening.hiredApplication
                          ? `${opening.hiredApplication.candidate.firstName} ${opening.hiredApplication.candidate.lastName}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => initiateDeleteOpening(opening.id)}
                          className="p-1 text-gray-400 hover:text-danger-500 transition-colors"
                          title="Delete opening"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No openings configured</p>
              <Button variant="outline" size="sm" onClick={handleAddOpening}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add First Opening
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
