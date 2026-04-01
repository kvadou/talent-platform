'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  PlusIcon,
  BuildingStorefrontIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

type Recruiter = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
};

type Agency = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  feePercentage: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  recruiterCount: number;
  recruiters: Recruiter[];
  candidateCount: number;
  hiredCount: number;
  activeJobCount: number;
};

type AgencyFormData = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  feePercentage: string;
  notes: string;
};

type RecruiterFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRecruitersModal, setShowRecruitersModal] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);

  // Form state
  const [formData, setFormData] = useState<AgencyFormData>({
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    feePercentage: '',
    notes: '',
  });
  const [recruiterForm, setRecruiterForm] = useState<RecruiterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAgencies();
  }, []);

  async function fetchAgencies() {
    try {
      const response = await fetch('/api/agencies');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAgencies(data.agencies);
    } catch {
      setError('Failed to load agencies');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setFormData({
      name: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      feePercentage: '',
      notes: '',
    });
    setShowAddModal(true);
  }

  function openEditModal(agency: Agency) {
    setSelectedAgency(agency);
    setFormData({
      name: agency.name,
      contactName: agency.contactName || '',
      contactEmail: agency.contactEmail || '',
      contactPhone: agency.contactPhone || '',
      website: agency.website || '',
      feePercentage: agency.feePercentage?.toString() || '',
      notes: agency.notes || '',
    });
    setShowEditModal(true);
  }

  function openDeleteModal(agency: Agency) {
    setSelectedAgency(agency);
    setShowDeleteModal(true);
  }

  function openRecruitersModal(agency: Agency) {
    setSelectedAgency(agency);
    setRecruiterForm({ firstName: '', lastName: '', email: '', phone: '' });
    setShowRecruitersModal(true);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const response = await fetch('/api/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          website: formData.website || null,
          feePercentage: formData.feePercentage ? parseFloat(formData.feePercentage) : null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create');
      await fetchAgencies();
      setShowAddModal(false);
    } catch {
      setError('Failed to create agency');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedAgency) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/agencies/${selectedAgency.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          website: formData.website || null,
          feePercentage: formData.feePercentage ? parseFloat(formData.feePercentage) : null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      await fetchAgencies();
      setShowEditModal(false);
    } catch {
      setError('Failed to update agency');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedAgency) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/agencies/${selectedAgency.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchAgencies();
      setShowDeleteModal(false);
    } catch {
      setError('Failed to delete agency');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRecruiter() {
    if (!selectedAgency) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/agencies/${selectedAgency.id}/recruiters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: recruiterForm.firstName,
          lastName: recruiterForm.lastName,
          email: recruiterForm.email,
          phone: recruiterForm.phone || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to add recruiter');
      await fetchAgencies();
      // Refresh selected agency
      const updated = agencies.find((a) => a.id === selectedAgency.id);
      if (updated) {
        const refreshResponse = await fetch('/api/agencies');
        const refreshData = await refreshResponse.json();
        const refreshedAgency = refreshData.agencies.find((a: Agency) => a.id === selectedAgency.id);
        setSelectedAgency(refreshedAgency);
      }
      setRecruiterForm({ firstName: '', lastName: '', email: '', phone: '' });
    } catch {
      setError('Failed to add recruiter');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecruiter(recruiterId: string) {
    if (!selectedAgency) return;
    try {
      const response = await fetch(`/api/agencies/${selectedAgency.id}/recruiters`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruiterId }),
      });

      if (!response.ok) throw new Error('Failed to delete recruiter');
      await fetchAgencies();
      // Refresh selected agency
      const refreshResponse = await fetch('/api/agencies');
      const refreshData = await refreshResponse.json();
      const refreshedAgency = refreshData.agencies.find((a: Agency) => a.id === selectedAgency.id);
      setSelectedAgency(refreshedAgency);
    } catch {
      setError('Failed to delete recruiter');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Agencies</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure agencies and invite them to submit candidates
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading agencies...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agencies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure agencies and invite them to submit candidates
          </p>
        </div>
        <Button onClick={openAddModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Agency
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader title="Partner Agencies" />
        <CardContent className="p-0">
          {agencies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No agencies yet. Click &quot;Add Agency&quot; to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {agencies.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-warning-50 rounded-lg">
                      <BuildingStorefrontIcon className="w-5 h-5 text-warning-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{agency.name}</span>
                        <Badge variant={agency.isActive ? 'success' : 'neutral'}>
                          {agency.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {agency.feePercentage && (
                          <Badge variant="neutral">{agency.feePercentage}% fee</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {agency.contactEmail || 'No contact email'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>{agency.recruiterCount} recruiters</span>
                        <span>{agency.candidateCount} candidates</span>
                        <span>{agency.hiredCount} hired</span>
                        <span>{agency.activeJobCount} jobs</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openRecruitersModal(agency)}
                      className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg"
                      title="Manage Recruiters"
                    >
                      <UserGroupIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(agency)}
                      className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg"
                      title="Edit Agency"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(agency)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                      title="Delete Agency"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Agency Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Agency"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Agency name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="contact@agency.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fee Percentage
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.feePercentage}
                onChange={(e) => setFormData({ ...formData, feePercentage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="20.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="https://agency.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Additional notes about this agency..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !formData.name}>
              {saving ? 'Creating...' : 'Create Agency'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Agency Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Agency"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agency Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fee Percentage
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.feePercentage}
                onChange={(e) => setFormData({ ...formData, feePercentage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving || !formData.name}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Agency"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedAgency?.name}</strong>? This will also
            delete all associated recruiters and candidate submissions.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Agency'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recruiters Modal */}
      <Modal
        open={showRecruitersModal}
        onClose={() => setShowRecruitersModal(false)}
        title={`Recruiters - ${selectedAgency?.name}`}
      >
        <div className="space-y-4">
          {/* Add Recruiter Form */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Add Recruiter</h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={recruiterForm.firstName}
                onChange={(e) =>
                  setRecruiterForm({ ...recruiterForm, firstName: e.target.value })
                }
                placeholder="First name"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                value={recruiterForm.lastName}
                onChange={(e) =>
                  setRecruiterForm({ ...recruiterForm, lastName: e.target.value })
                }
                placeholder="Last name"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="email"
                value={recruiterForm.email}
                onChange={(e) => setRecruiterForm({ ...recruiterForm, email: e.target.value })}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="tel"
                value={recruiterForm.phone}
                onChange={(e) => setRecruiterForm({ ...recruiterForm, phone: e.target.value })}
                placeholder="Phone (optional)"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddRecruiter}
              disabled={
                saving ||
                !recruiterForm.firstName ||
                !recruiterForm.lastName ||
                !recruiterForm.email
              }
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Recruiter
            </Button>
          </div>

          {/* Recruiters List */}
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {selectedAgency?.recruiters.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-sm">
                No recruiters added yet
              </div>
            ) : (
              selectedAgency?.recruiters.map((recruiter) => (
                <div
                  key={recruiter.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {recruiter.firstName} {recruiter.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{recruiter.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={recruiter.isActive ? 'success' : 'neutral'}>
                      {recruiter.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <button
                      onClick={() => handleDeleteRecruiter(recruiter.id)}
                      className="p-1 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowRecruitersModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
