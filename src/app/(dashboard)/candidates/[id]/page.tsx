'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ResumeViewer } from '@/components/applications/ResumeViewer';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { CandidateNotes } from '@/components/candidates/CandidateNotes';
import { BackgroundCheckSection } from '@/components/candidates/BackgroundCheckSection';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TrashIcon, PencilIcon, CheckIcon, XMarkIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

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

type CandidateDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  secondaryEmail: string | null;
  phone: string | null;
  timezone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  tags: string[];
  notes: string | null;
  greenhouseCandidateId: string | null;
  applications: Array<{
    id: string;
    status: string;
    job: {
      id: string;
      title: string;
      market: { name: string };
    };
    stage: {
      id: string;
      name: string;
    };
    interviews: Array<{ id: string }>;
    notes: Array<{ id: string }>;
  }>;
};

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
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
}

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [swappingEmail, setSwappingEmail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveField(field: string, value: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/candidates/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-fields', [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setCandidate((prev) => prev ? { ...prev, [field]: data.candidate[field] } : prev);
      }
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }

  function startEdit(field: string, currentValue: string | null) {
    setEditingField(field);
    setEditValue(currentValue || '');
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/candidates/${params.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/candidates');
    } else {
      const data = await res.json();
      setDeleting(false);
      setShowDeleteModal(false);
      // Show error inline — could enhance later
      console.error('Delete failed:', data.error);
    }
  }

  useEffect(() => {
    async function fetchCandidate() {
      const res = await fetch(`/api/candidates/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCandidate(data.candidate);
      setLoading(false);
    }
    fetchCandidate();
  }, [params.id]);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  if (notFound || !candidate) {
    return <div className="p-6 text-gray-500">Candidate not found</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{candidate.email}</p>
          {candidate.secondaryEmail && (
            <p className="text-xs text-gray-400 mt-0.5">
              Alt: {candidate.secondaryEmail}
            </p>
          )}
          {candidate.phone && <p className="text-sm text-gray-600">{candidate.phone}</p>}
        </div>
        <div className="flex items-center gap-3">
          {candidate.greenhouseCandidateId && (
            <Badge variant="neutral">Greenhouse ID: {candidate.greenhouseCandidateId}</Badge>
          )}
          <Button
            variant="danger"
            size="sm"
            icon={<TrashIcon className="h-4 w-4" />}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Candidate Info */}
        <div className="space-y-4 xl:col-span-1">
          {/* Contact Information */}
          <Card>
            <CardHeader title="Contact Information" />
            <CardContent className="space-y-3 text-sm">
              {/* First Name */}
              <div>
                <div className="text-xs text-gray-500 mb-1">First Name</div>
                {editingField === 'firstName' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveField('firstName', editValue);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => saveField('firstName', editValue)} disabled={saving} className="text-success-600 hover:text-success-700"><CheckIcon className="w-4 h-4" /></button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-gray-900">{candidate.firstName}</span>
                    <button onClick={() => startEdit('firstName', candidate.firstName)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-purple transition-opacity"><PencilIcon className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              {/* Last Name */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Last Name</div>
                {editingField === 'lastName' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveField('lastName', editValue);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => saveField('lastName', editValue)} disabled={saving} className="text-success-600 hover:text-success-700"><CheckIcon className="w-4 h-4" /></button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-gray-900">{candidate.lastName}</span>
                    <button onClick={() => startEdit('lastName', candidate.lastName)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-purple transition-opacity"><PencilIcon className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              {/* Email */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                {editingField === 'email' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveField('email', editValue);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => saveField('email', editValue)} disabled={saving} className="text-success-600 hover:text-success-700"><CheckIcon className="w-4 h-4" /></button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-gray-900">{candidate.email}</span>
                    <button onClick={() => startEdit('email', candidate.email)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-purple transition-opacity"><PencilIcon className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {candidate.secondaryEmail && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{candidate.secondaryEmail}</span>
                    <span className="text-xs text-gray-400">(from resume)</span>
                    <button
                      onClick={async () => {
                        setSwappingEmail(true);
                        try {
                          const res = await fetch(`/api/candidates/${candidate.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'swap-emails' }),
                          });
                          if (res.ok) {
                            setCandidate({
                              ...candidate,
                              email: candidate.secondaryEmail!,
                              secondaryEmail: candidate.email,
                            });
                          }
                        } finally {
                          setSwappingEmail(false);
                        }
                      }}
                      disabled={swappingEmail}
                      className="text-xs text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
                    >
                      {swappingEmail ? 'Swapping...' : 'Make primary'}
                    </button>
                  </div>
                )}
              </div>
              {/* Phone */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Phone</div>
                {editingField === 'phone' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="tel"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveField('phone', editValue);
                        if (e.key === 'Escape') setEditingField(null);
                      }}
                    />
                    <button onClick={() => saveField('phone', editValue)} disabled={saving} className="text-success-600 hover:text-success-700"><CheckIcon className="w-4 h-4" /></button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <span className="text-gray-900">{candidate.phone || <span className="text-gray-400">—</span>}</span>
                    <button onClick={() => startEdit('phone', candidate.phone)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-purple transition-opacity"><PencilIcon className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              {/* Timezone */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Timezone</div>
                <div className="flex items-center gap-2">
                  <GlobeAltIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <select
                    value={candidate.timezone || ''}
                    onChange={async (e) => {
                      const tz = e.target.value || null;
                      await saveField('timezone', tz || '');
                    }}
                    className="text-sm text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(candidate.street || candidate.city || candidate.state) && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Address</div>
                  <div className="text-gray-900">
                    {[candidate.street, candidate.city, candidate.state, candidate.country, candidate.postcode]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              )}
              {candidate.linkedinUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">LinkedIn</div>
                  <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
                    View Profile
                  </a>
                </div>
              )}
              {candidate.portfolioUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Portfolio</div>
                  <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-brand-purple hover:underline">
                    View Portfolio
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {candidate.tags.length > 0 && (
            <Card>
              <CardHeader title="Tags" />
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {candidate.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resume */}
          <ResumeViewer url={candidate.resumeUrl} />

          {/* Background Check */}
          <BackgroundCheckSection
            candidateId={candidate.id}
            candidateName={`${candidate.firstName} ${candidate.lastName}`}
          />

          {/* Notes */}
          <CandidateNotes candidateId={candidate.id} />
        </div>

        {/* Right Column - Applications */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title={`Applications (${candidate.applications.length})`} />
            <CardContent className="p-0">
              <div className="p-4 lg:p-0">
                {candidate.applications.length > 0 ? (
                  <ResponsiveTable
                    data={candidate.applications}
                    columns={[
                      {
                        header: 'Job',
                        accessor: (app) => (
                          <div>
                            <Link href={`/jobs/${app.job.id}`} className="text-sm font-semibold text-brand-purple hover:underline block">
                              {app.job.title}
                            </Link>
                            <div className="text-xs text-gray-500">{app.job.market.name}</div>
                          </div>
                        ),
                      },
                      {
                        header: 'Stage',
                        accessor: (app) => <span className="text-sm text-gray-700">{app.stage.name}</span>,
                      },
                      {
                        header: 'Status',
                        accessor: (app) => <Badge variant={statusVariant(app.status)}>{app.status}</Badge>,
                      },
                      {
                        header: 'Interviews',
                        accessor: (app) => (
                          <span className="text-sm text-gray-600">
                            {app.interviews.length} scheduled
                          </span>
                        ),
                      },
                      {
                        header: 'Notes',
                        accessor: (app) => (
                          <span className="text-sm text-gray-600">
                            {app.notes.length} note{app.notes.length !== 1 ? 's' : ''}
                          </span>
                        ),
                      },
                      {
                        header: 'Actions',
                        className: 'text-right',
                        accessor: (app) => (
                          <Link href={`/applications/${app.id}`} className="text-brand-purple hover:underline text-sm">
                            View Application
                          </Link>
                        ),
                      },
                    ]}
                    keyExtractor={(app) => app.id}
                    emptyMessage="No applications found."
                    onRowClick={(app) => router.push(`/applications/${app.id}`)}
                  />
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>This candidate has no applications yet.</p>
                    <p className="text-sm mt-2">Create an application from a job posting.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Candidate"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              Permanently Delete
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to permanently delete <span className="font-semibold">{candidate.firstName} {candidate.lastName}</span>?
          </p>
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 text-sm text-danger-800">
            <p className="font-medium mb-1">This cannot be undone. The following will be permanently deleted:</p>
            <ul className="list-disc list-inside space-y-0.5 text-danger-700">
              <li>All {candidate.applications.length} application{candidate.applications.length !== 1 ? 's' : ''} and their history</li>
              <li>All interviews, scorecards, and recordings</li>
              <li>All notes, messages, and activity logs</li>
              <li>Resume, background checks, and offers</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

