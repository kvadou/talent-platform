'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  ArrowLeftIcon,
  DocumentArrowUpIcon,
  UserIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  LinkIcon,
  TagIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type Job = {
  id: string;
  title: string;
  department: { name: string } | null;
  market: { name: string };
  stages: { id: string; name: string; order: number }[];
};

export default function AddCandidatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId');
  const [mode, setMode] = useState<'job' | 'prospect'>(preselectedJobId ? 'job' : 'job');
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [source, setSource] = useState('');
  const [referrer, setReferrer] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeS3Key, setResumeS3Key] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; firstName: string | null; lastName: string | null; email: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Pre-select job from URL param after jobs are loaded
  useEffect(() => {
    if (preselectedJobId && jobs.length > 0 && !selectedJobId) {
      const job = jobs.find((j) => j.id === preselectedJobId);
      if (job) {
        setSelectedJobId(preselectedJobId);
      }
    }
  }, [preselectedJobId, jobs, selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      const job = jobs.find((j) => j.id === selectedJobId);
      setSelectedJob(job || null);
      if (job && job.stages.length > 0) {
        setSelectedStageId(job.stages[0].id);
      }
    } else {
      setSelectedJob(null);
      setSelectedStageId('');
    }
  }, [selectedJobId, jobs]);

  async function fetchData() {
    try {
      const [jobsRes, usersRes] = await Promise.all([
        fetch('/api/jobs?status=PUBLISHED'),
        fetch('/api/users'),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleResumeUpload(file: File) {
    setResumeFile(file);
    setResumeError(null);
    setUploadingResume(true);

    try {
      // 1. Get presigned upload URL
      const uploadRes = await fetch('/api/upload/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, fileUrl } = await uploadRes.json();

      // 2. Upload file directly to S3
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!s3Res.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Store the S3 key
      setResumeS3Key(fileUrl);
      setUploadingResume(false);

      // 3. Parse resume to auto-fill form
      setParsingResume(true);
      const parseRes = await fetch('/api/parse/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: fileUrl }),
      });

      if (parseRes.ok) {
        const { data } = await parseRes.json();
        // Auto-fill form fields (only if currently empty)
        if (data.firstName && !firstName) setFirstName(data.firstName);
        if (data.lastName && !lastName) setLastName(data.lastName);
        if (data.email && !email) setEmail(data.email);
        if (data.phone && !phone) setPhone(data.phone);
        if (data.linkedinUrl && !linkedinUrl) setLinkedinUrl(data.linkedinUrl);
      }
    } catch (err) {
      console.error('Resume upload/parse failed:', err);
      setResumeError(err instanceof Error ? err.message : 'Failed to process resume');
    } finally {
      setUploadingResume(false);
      setParsingResume(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setSaving(true);
    try {
      // First create the candidate
      const candidateRes = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          country: country.trim() || null,
          currentCompany: currentCompany.trim() || null,
          currentTitle: currentTitle.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          portfolioUrl: portfolioUrl.trim() || null,
          resumeUrl: resumeS3Key || null,
          tags,
          source: source || null,
          sourceDetails: referrer.trim() || null,
        }),
      });

      if (!candidateRes.ok) {
        throw new Error('Failed to create candidate');
      }

      const candidate = await candidateRes.json();

      // If mode is 'job' and a job is selected, create an application
      if (mode === 'job' && selectedJobId && selectedStageId) {
        await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateId: candidate.id,
            jobId: selectedJobId,
            stageId: selectedStageId,
            source: source.trim() || 'Manual',
          }),
        });
      }

      // Redirect to candidate page
      router.push(`/candidates/${candidate.id}`);
    } catch (err) {
      console.error('Failed to create candidate:', err);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/candidates"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add a Candidate</h1>
          <p className="text-sm text-gray-500">
            Add a new candidate to your talent pool
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Resume Upload */}
        <Card>
          <CardContent className="p-6">
            <label
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                resumeS3Key
                  ? 'border-success-300 bg-success-50/30'
                  : resumeError
                  ? 'border-danger-300 bg-danger-50/30'
                  : 'border-gray-200 hover:border-brand-purple/50 hover:bg-purple-50/30'
              }`}
            >
              {uploadingResume || parsingResume ? (
                <>
                  <ArrowPathIcon className="w-10 h-10 text-brand-purple mb-3 animate-spin" />
                  <span className="text-sm font-medium text-gray-700">
                    {uploadingResume ? 'Uploading resume...' : 'Parsing resume with AI...'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">This may take a few seconds</span>
                </>
              ) : resumeS3Key ? (
                <>
                  <CheckCircleIcon className="w-10 h-10 text-success-500 mb-3" />
                  <span className="text-sm font-medium text-gray-700">
                    {resumeFile?.name || 'Resume uploaded'}
                  </span>
                  <span className="text-xs text-success-600 mt-1">Parsed successfully • Click to replace</span>
                </>
              ) : (
                <>
                  <DocumentArrowUpIcon className="w-10 h-10 text-gray-400 mb-3" />
                  <span className="text-sm font-medium text-gray-700">
                    Drag resume to parse or click to upload
                  </span>
                  <span className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</span>
                </>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                disabled={uploadingResume || parsingResume}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleResumeUpload(file);
                }}
              />
            </label>
            {resumeError && (
              <p className="text-sm text-danger-600 mt-2 text-center">{resumeError}</p>
            )}
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setMode('job')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  mode === 'job'
                    ? 'border-brand-purple bg-purple-50 text-brand-purple'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <BriefcaseIcon className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Candidate for a job</div>
                <div className="text-xs text-gray-500 mt-1">Apply to a specific position</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('prospect')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  mode === 'prospect'
                    ? 'border-brand-purple bg-purple-50 text-brand-purple'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <UserIcon className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Prospect</div>
                <div className="text-xs text-gray-500 mt-1">Add to talent pool</div>
              </button>
            </div>

            {/* Job Selection */}
            {mode === 'job' && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job <span className="text-danger-500">*</span>
                  </label>
                  <Select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    required={mode === 'job'}
                  >
                    <option value="">Select a job...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} — {job.market.name}
                        {job.department ? ` (${job.department.name})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedJob && selectedJob.stages.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Initial Stage
                    </label>
                    <Select
                      value={selectedStageId}
                      onChange={(e) => setSelectedStageId(e.target.value)}
                    >
                      {selectedJob.stages
                        .sort((a, b) => a.order - b.order)
                        .map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Name & Company */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Name & Company
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name <span className="text-danger-500">*</span>
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last name <span className="text-danger-500">*</span>
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Company
                </label>
                <Input
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Title
                </label>
                <Input
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <EnvelopeIcon className="w-4 h-4" />
              Contact Information
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPinIcon className="w-4 h-4" />
              Location
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="USA"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Links
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio / Website
                </label>
                <Input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source & Tags */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              Source & Tags
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <Select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">Select source...</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="INDEED">Indeed</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="CAREER_PAGE">Career Site</option>
                  <option value="AGENCY">Agency</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Who Gets Credit
                </label>
                <Select value={referrer} onChange={(e) => setReferrer(e.target.value)}>
                  <option value="">Select a person...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}>
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Person who sourced or referred this candidate
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <PlusIcon className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm"
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)}>
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                placeholder="Any additional notes about this candidate..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link href="/candidates">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving || !firstName.trim() || !lastName.trim() || (mode === 'job' && !selectedJobId)}
          >
            {saving ? 'Adding...' : 'Add Candidate'}
          </Button>
        </div>
      </form>
    </div>
  );
}
