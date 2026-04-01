'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { sanitizeHtml } from '@/lib/sanitize';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import {
  DocumentTextIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  PauseIcon,
  PlayIcon,
  GlobeAltIcon,
  ClipboardDocumentIcon,
  HomeIcon,
  BriefcaseIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  BoltIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

type JobPost = {
  id: string;
  jobId: string;
  boardType: string;
  boardName: string;
  title: string | null;
  content: string | null;
  location: string | null;
  externalUrl: string | null;
  externalId: string | null;
  status: 'DRAFT' | 'LIVE' | 'PAUSED' | 'EXPIRED' | 'CLOSED';
  postedAt: string | null;
  expiresAt: string | null;
  applications: number;
  views: number;
  createdAt: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  location: string | null;
  market: { name: string };
};

const BOARD_TYPES = [
  { value: 'INTERNAL', label: 'Career Page', Icon: HomeIcon },
  { value: 'INDEED', label: 'Indeed', Icon: GlobeAltIcon },
  { value: 'LINKEDIN', label: 'LinkedIn', Icon: BriefcaseIcon },
  { value: 'GOOGLE_JOBS', label: 'Google Jobs', Icon: MagnifyingGlassIcon },
  { value: 'GLASSDOOR', label: 'Glassdoor', Icon: BuildingOfficeIcon },
  { value: 'ZIPRECRUITER', label: 'ZipRecruiter', Icon: BoltIcon },
  { value: 'OTHER', label: 'Other', Icon: LinkIcon },
];

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  DRAFT: 'neutral',
  LIVE: 'success',
  PAUSED: 'warning',
  EXPIRED: 'error',
  CLOSED: 'neutral',
};

// sanitizeHtml imported from @/lib/sanitize (uses DOMPurify)

export default function JobPostsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [posts, setPosts] = useState<JobPost[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<JobPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<JobPost | null>(null);
  const [previewPost, setPreviewPost] = useState<JobPost | null>(null);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [togglingCareers, setTogglingCareers] = useState(false);

  // Form state
  const [formBoardType, setFormBoardType] = useState('INTERNAL');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, jobRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/posts`),
        fetch(`/api/jobs/${jobId}`),
      ]);

      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.posts);
      }
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob(jobData);
      }
    } catch {
      setError('Failed to load job posts');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateModal() {
    setFormBoardType('INTERNAL');
    setFormTitle(job?.title || '');
    setFormContent(job?.description || '');
    setFormLocation(job?.location || job?.market?.name || '');
    setFormExpiresAt('');
    setEditingPost(null);
    setShowCreateModal(true);
  }

  function openEditModal(post: JobPost) {
    setFormBoardType(post.boardType);
    setFormTitle(post.title || job?.title || '');
    setFormContent(post.content || job?.description || '');
    setFormLocation(post.location || job?.location || '');
    setFormExpiresAt(post.expiresAt ? post.expiresAt.split('T')[0] : '');
    setEditingPost(post);
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingPost(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        boardType: formBoardType,
        title: formTitle,
        content: formContent,
        location: formLocation,
        expiresAt: formExpiresAt || null,
      };

      let res: Response;
      if (editingPost) {
        res = await fetch(`/api/jobs/${jobId}/posts/${editingPost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/jobs/${jobId}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      closeModal();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job post');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(post: JobPost, newStatus: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchData();
    } catch {
      setError('Failed to update post status');
    }
  }

  async function handleDelete() {
    if (!deletingPost) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/posts/${deletingPost.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeletingPost(null);
      fetchData();
    } catch {
      setError('Failed to delete job post');
    }
  }

  function copyFeedUrl() {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/api/public/indeed-feed`);
    setCopiedFeedUrl(true);
    setTimeout(() => setCopiedFeedUrl(false), 2000);
  }

  async function handleToggleCareersPage(newStatus: 'PUBLISHED' | 'DRAFT') {
    setTogglingCareers(true);
    setShowUnpublishConfirm(false);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update job status');
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job status');
    } finally {
      setTogglingCareers(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-6 h-6 text-brand-purple" />
              Job Posts
            </h1>
            <p className="text-gray-600 mt-1 text-sm">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const livePosts = posts.filter((p) => p.status === 'LIVE').length;
  const totalApplications = posts.reduce((sum, p) => sum + p.applications, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 text-brand-purple" />
            Job Posts
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Manage postings across different job boards
          </p>
        </div>
        <Button onClick={openCreateModal} icon={<PlusIcon className="w-4 h-4" />}>
          New Post
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Summary */}
      {posts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
              <p className="text-xs text-gray-500">Total Posts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success-600">{livePosts}</p>
              <p className="text-xs text-gray-500">Live</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-cyan-600">{totalApplications}</p>
              <p className="text-xs text-gray-500">Applications</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Careers Page Status */}
      {job && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${job.status === 'PUBLISHED' ? 'bg-success-100' : 'bg-gray-100'}`}>
                  <GlobeAltIcon className={`w-5 h-5 ${job.status === 'PUBLISHED' ? 'text-success-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Careers Page</p>
                  <p className="text-sm text-gray-500">
                    {job.status === 'PUBLISHED'
                      ? 'This job is live on your careers page'
                      : 'This job is not on your careers page'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={job.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {job.status === 'PUBLISHED' ? 'Live' : 'Off'}
                </Badge>
                {job.status === 'PUBLISHED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnpublishConfirm(true)}
                    className="text-warning-600 border-warning-300 hover:bg-warning-50"
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleToggleCareersPage('PUBLISHED')}
                    disabled={togglingCareers}
                  >
                    {togglingCareers ? 'Publishing...' : 'Publish'}
                  </Button>
                )}
                {job.status === 'PUBLISHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/careers/${jobId}`, '_blank')}
                  >
                    <EyeIcon className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
                <Link href={`/jobs/${jobId}/setup/info`}>
                  <Button variant="ghost" size="sm">
                    <PencilSquareIcon className="w-4 h-4 mr-1" />
                    Edit Description
                  </Button>
                </Link>
                <Link href={`/jobs/${jobId}/setup/forms`}>
                  <Button variant="ghost" size="sm">
                    <DocumentTextIcon className="w-4 h-4 mr-1" />
                    Edit Questions
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unpublish Confirmation */}
      <ConfirmModal
        open={showUnpublishConfirm}
        onClose={() => setShowUnpublishConfirm(false)}
        onConfirm={() => handleToggleCareersPage('DRAFT')}
        title="Unpublish from Careers Page"
        message="This will remove the job from your careers page. Candidates won't be able to find or apply to this job. You can republish at any time."
        confirmLabel="Unpublish"
        variant="danger"
      />

      {/* Posts List */}
      {posts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <GlobeAltIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No additional job board posts</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a post to publish this job to Indeed, LinkedIn, and other job boards.
              </p>
              <Button
                onClick={openCreateModal}
                className="mt-4"
                icon={<PlusIcon className="w-4 h-4" />}
              >
                Create Board Post
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Posts" />
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {posts.map((post) => {
                const boardInfo = BOARD_TYPES.find((b) => b.value === post.boardType);
                return (
                  <div key={post.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="flex-shrink-0 mt-0.5">
                          {boardInfo ? <boardInfo.Icon className="w-5 h-5 text-gray-500" /> : <GlobeAltIcon className="w-5 h-5 text-gray-500" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {post.boardName}
                            </span>
                            <Badge variant={STATUS_COLORS[post.status]}>
                              {post.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 truncate">
                            {post.title || job?.title || 'Untitled'}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            {post.location && <span>{post.location}</span>}
                            <span>{post.applications} applications</span>
                            {post.postedAt && (
                              <span>Published {formatDate(post.postedAt)}</span>
                            )}
                            {post.expiresAt && (
                              <span>Expires {formatDate(post.expiresAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                        {post.content && (
                          <button
                            onClick={() => setPreviewPost(post)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                            title="Preview"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                        {post.status === 'DRAFT' && (
                          <button
                            onClick={() => handleStatusChange(post, 'LIVE')}
                            className="p-1.5 text-success-500 hover:text-success-700 rounded"
                            title="Publish"
                          >
                            <PlayIcon className="w-4 h-4" />
                          </button>
                        )}
                        {post.status === 'LIVE' && (
                          <button
                            onClick={() => handleStatusChange(post, 'PAUSED')}
                            className="p-1.5 text-yellow-500 hover:text-yellow-700 rounded"
                            title="Pause"
                          >
                            <PauseIcon className="w-4 h-4" />
                          </button>
                        )}
                        {post.status === 'PAUSED' && (
                          <button
                            onClick={() => handleStatusChange(post, 'LIVE')}
                            className="p-1.5 text-success-500 hover:text-success-700 rounded"
                            title="Resume"
                          >
                            <PlayIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(post)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPost(post)}
                          className="p-1.5 text-gray-400 hover:text-danger-500 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed URL Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Indeed XML Feed URL</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Register this URL with Indeed, Glassdoor, SimplyHired, and other job aggregators
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyFeedUrl}>
              <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
              {copiedFeedUrl ? 'Copied!' : 'Copy URL'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={showCreateModal}
        onClose={closeModal}
        title={editingPost ? 'Edit Job Post' : 'New Job Post'}
        className="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingPost ? 'Save Changes' : 'Create Post'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Board Type (only for new posts) */}
          {!editingPost && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Board *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BOARD_TYPES.map((board) => (
                  <button
                    key={board.value}
                    onClick={() => setFormBoardType(board.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left text-sm font-medium transition-colors ${
                      formBoardType === board.value
                        ? 'border-brand-purple bg-purple-50 text-brand-purple'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <board.Icon className={`w-4 h-4 ${formBoardType === board.value ? 'text-brand-purple' : 'text-gray-400'}`} />
                    {board.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Title
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={job?.title || 'Job title'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to use the job title. Customize for SEO on specific boards.
            </p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              placeholder={job?.location || job?.market?.name || 'Location'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration Date
            </label>
            <input
              type="date"
              value={formExpiresAt}
              onChange={(e) => setFormExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            />
            <p className="text-xs text-gray-400 mt-1">
              Optional. The post will auto-expire on this date.
            </p>
          </div>

          {/* Content (Rich Text) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post Description
            </label>
            <RichTextEditor
              value={formContent}
              onChange={setFormContent}
              placeholder="Enter the candidate-facing job description..."
            />
            <p className="text-xs text-gray-400 mt-1">
              This is the description candidates see. Pre-filled from the job description — customize per board.
            </p>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={!!previewPost}
        onClose={() => setPreviewPost(null)}
        title={`Preview: ${previewPost?.title || job?.title || 'Job Post'}`}
        className="max-w-3xl"
      >
        {previewPost?.content && (
          <div
            className="prose prose-sm max-w-none text-gray-700
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900
              [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3
              [&_ul]:list-disc [&_ul]:pl-5
              [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mb-1
              [&_strong]:font-semibold [&_strong]:text-gray-900
              [&_a]:text-cyan-600 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewPost.content) }}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deletingPost}
        onClose={() => setDeletingPost(null)}
        onConfirm={handleDelete}
        title="Delete Job Post"
        message={`Are you sure you want to delete the ${deletingPost?.boardName} post? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
