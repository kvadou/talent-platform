'use client';

import { useState, useEffect, useRef } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { Dialog } from '@headlessui/react';
import { format, isPast } from 'date-fns';
import {
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  LinkIcon,
  EnvelopeIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { ScorecardForm } from './ScorecardForm';

interface InterviewKitModalProps {
  interviewId: string;
  open: boolean;
  onClose: () => void;
  onFeedbackSubmitted?: () => void;
}

interface InterviewData {
  id: string;
  scheduledAt: string;
  duration: number;
  type: string;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  interviewer: {
    id: string;
    name: string;
    email: string;
  };
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string | null;
    linkedinUrl: string | null;
    currentTitle: string | null;
    currentCompany: string | null;
    resume: {
      id: string;
      url: string;
      filename: string;
    } | null;
    notes: Array<{
      id: string;
      content: string;
      user: { firstName: string; lastName: string };
      createdAt: string;
    }>;
  };
  job: {
    id: string;
    title: string;
    department: string | null;
    location: string | null;
    employmentType: string | null;
    description: string | null;
    requirements: string | null;
    responsibilities: string | null;
    interviewPrep: {
      id: string;
      content: string;
    } | null;
  };
  application: {
    id: string;
    status: string;
    source: string | null;
    createdAt: string;
  };
  stage: {
    id: string;
    name: string;
  } | null;
  scorecard: {
    id: string;
    name: string;
    description: string | null;
    criteria: unknown;
  } | null;
  feedback: Array<{
    id: string;
    userId: string;
    userName: string;
    scores: unknown;
    recommendation: string | null;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
    submittedAt: string | null;
  }>;
  userFeedback: {
    id: string;
    scores: unknown;
    recommendation: string | null;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
    submittedAt: string | null;
  } | null;
  hasFeedback: boolean;
}

const TABS = [
  { key: 'prep', label: 'Interview Prep', icon: BookOpenIcon },
  { key: 'job', label: 'Job Details', icon: BriefcaseIcon },
  { key: 'resume', label: 'Resume', icon: DocumentTextIcon },
  { key: 'scorecard', label: 'Scorecard', icon: ClipboardDocumentListIcon },
] as const;

type TabKey = typeof TABS[number]['key'];

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone Screen',
  VIDEO_INTERVIEW: 'Video Interview',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  BEHAVIORAL_INTERVIEW: 'Behavioral Interview',
  FINAL_INTERVIEW: 'Final Interview',
  ONSITE: 'Onsite',
};

export function InterviewKitModal({
  interviewId,
  open,
  onClose,
  onFeedbackSubmitted,
}: InterviewKitModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('prep');
  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !interviewId) return;

    async function fetchInterview() {
      setLoading(true);
      try {
        const res = await fetch(`/api/interviews/${interviewId}`);
        if (!res.ok) throw new Error('Failed to load interview');
        const json = await res.json();
        setData(json);
        setError(null);

        // Auto-navigate to scorecard tab if interview is past and no feedback
        if (json && isPast(new Date(json.scheduledAt)) && !json.hasFeedback) {
          setActiveTab('scorecard');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchInterview();
  }, [interviewId, open]);

  const handleFeedbackSubmitted = () => {
    // Refresh data
    if (interviewId) {
      fetch(`/api/interviews/${interviewId}`)
        .then((res) => res.json())
        .then((json) => setData(json));
    }
    onFeedbackSubmitted?.();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-5xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          {data && (
            <div className="flex-shrink-0 border-b border-gray-200">
              <div className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-brand-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Interview Kit: {data.candidate.name}
                      </Dialog.Title>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <BriefcaseIcon className="h-4 w-4" />
                          {data.job.title}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(data.scheduledAt), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {format(new Date(data.scheduledAt), 'h:mm a')}
                        </span>
                        <span className="text-gray-400">
                          ({data.duration} min)
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Meeting Link */}
                {data.meetingLink && !isPast(new Date(data.scheduledAt)) && (
                  <div className="mt-3">
                    <a
                      href={data.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      <VideoCameraIcon className="h-5 w-5" />
                      Join Meeting
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="px-6">
                <nav className="flex gap-6 -mb-px">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`
                          flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors
                          ${isActive
                            ? 'border-brand-500 text-brand-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                        {tab.key === 'scorecard' && data.hasFeedback && (
                          <span className="ml-1 w-2 h-2 bg-success-500 rounded-full" />
                        )}
                        {tab.key === 'scorecard' && !data.hasFeedback && isPast(new Date(data.scheduledAt)) && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-warning-100 text-warning-700 rounded">
                            Pending
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-500 mt-4">Loading interview details...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-danger-600">{error}</div>
            ) : data ? (
              <div className="p-6">
                {activeTab === 'prep' && <PrepTab data={data} />}
                {activeTab === 'job' && <JobTab data={data} />}
                {activeTab === 'resume' && <ResumeTab data={data} />}
                {activeTab === 'scorecard' && (
                  <ScorecardTab data={data} onFeedbackSubmitted={handleFeedbackSubmitted} />
                )}
              </div>
            ) : null}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function PrepTab({ data }: { data: InterviewData }) {
  if (!data.job.interviewPrep?.content) {
    return (
      <div className="text-center py-12">
        <BookOpenIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Interview Prep</h3>
        <p className="text-gray-500">
          Interview preparation content has not been set up for this job.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="prose prose-sm max-w-none">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Preparation</h3>
        <div
          className="text-gray-600"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.job.interviewPrep.content) }}
        />
      </div>

      {/* Candidate Quick Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Candidate Overview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>
            <span className="ml-2 font-medium">{data.candidate.name}</span>
          </div>
          {data.candidate.currentTitle && (
            <div>
              <span className="text-gray-500">Current Role:</span>
              <span className="ml-2">{data.candidate.currentTitle}</span>
            </div>
          )}
          {data.candidate.currentCompany && (
            <div>
              <span className="text-gray-500">Company:</span>
              <span className="ml-2">{data.candidate.currentCompany}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Interview Type:</span>
            <span className="ml-2">{INTERVIEW_TYPE_LABELS[data.type] || data.type}</span>
          </div>
        </div>
      </div>

      {/* Recent Notes */}
      {data.candidate.notes.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Notes</h4>
          <div className="space-y-3">
            {data.candidate.notes.slice(0, 3).map((note) => (
              <div key={note.id} className="bg-white border rounded-lg p-3">
                <p className="text-sm text-gray-600">{note.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {note.user.firstName} {note.user.lastName} •{' '}
                  {format(new Date(note.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobTab({ data }: { data: InterviewData }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{data.job.title}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
          {data.job.department && <span>{data.job.department}</span>}
          {data.job.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4" />
              {data.job.location}
            </span>
          )}
          {data.job.employmentType && <span>{data.job.employmentType}</span>}
        </div>
      </div>

      {data.job.description && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Description</h4>
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.job.description) }}
          />
        </div>
      )}

      {data.job.responsibilities && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Responsibilities</h4>
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.job.responsibilities) }}
          />
        </div>
      )}

      {data.job.requirements && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Requirements</h4>
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.job.requirements) }}
          />
        </div>
      )}
    </div>
  );
}

function ResumeTab({ data }: { data: InterviewData }) {
  return (
    <div className="space-y-6">
      {/* Candidate Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{data.candidate.name}</h3>
            {data.candidate.currentTitle && (
              <p className="text-gray-600">
                {data.candidate.currentTitle}
                {data.candidate.currentCompany && ` at ${data.candidate.currentCompany}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data.candidate.linkedinUrl && (
              <a
                href={data.candidate.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LinkIcon className="h-5 w-5" />
              </a>
            )}
            <a
              href={`mailto:${data.candidate.email}`}
              className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <EnvelopeIcon className="h-5 w-5" />
            </a>
            {data.candidate.phone && (
              <a
                href={`tel:${data.candidate.phone}`}
                className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <PhoneIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Resume Viewer */}
      {data.candidate.resume ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b">
            <span className="text-sm font-medium text-gray-700">
              {data.candidate.resume.filename}
            </span>
            <a
              href={data.candidate.resume.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Open in new tab
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>
          <div className="bg-gray-100" style={{ height: '600px' }}>
            <iframe
              src={`${data.candidate.resume.url}#toolbar=0`}
              className="w-full h-full"
              title="Resume"
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Resume Available</h3>
          <p className="text-gray-500">
            No resume has been uploaded for this candidate.
          </p>
        </div>
      )}
    </div>
  );
}

function ScorecardTab({
  data,
  onFeedbackSubmitted,
}: {
  data: InterviewData;
  onFeedbackSubmitted: () => void;
}) {
  const isPastInterview = isPast(new Date(data.scheduledAt));
  const [aiSuggestions, setAiSuggestions] = useState<{
    scores: Record<string, number>;
    recommendation: string;
    strengths: string;
    concerns: string;
  } | null>(null);
  const aiFetchedRef = useRef(false);

  useEffect(() => {
    if (aiFetchedRef.current) return;
    if (data.userFeedback) return;
    if (!isPastInterview) return;

    aiFetchedRef.current = true;

    fetch(`/api/interviews/${data.id}/ai-suggestions`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((result) => {
        if (result && !result.error) {
          setAiSuggestions(result);
        }
      })
      .catch(() => {
        // AI suggestions are optional — fail silently
      });
  }, [data.id, data.userFeedback, isPastInterview]);

  if (!isPastInterview) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Interview Not Yet Completed</h3>
        <p className="text-gray-500">
          You can submit your scorecard after the interview is complete.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Scheduled for {format(new Date(data.scheduledAt), 'EEEE, MMMM d, yyyy')} at{' '}
          {format(new Date(data.scheduledAt), 'h:mm a')}
        </p>
      </div>
    );
  }

  return (
    <ScorecardForm
      interviewId={data.id}
      scorecard={data.scorecard}
      existingFeedback={data.userFeedback}
      onSubmit={onFeedbackSubmitted}
      aiSuggestions={aiSuggestions}
    />
  );
}
