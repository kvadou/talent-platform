'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';
import { format, isPast } from 'date-fns';
import {
  ArrowLeftIcon,
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
  PlayIcon,
  MicrophoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { InterviewKitScorecard } from '@/components/interview-kits/InterviewKitScorecard';
import { InterviewRecordingPlayer } from '@/components/interview-kits/InterviewRecordingPlayer';
import { InterviewTranscriptViewer } from '@/components/interview-kits/InterviewTranscriptViewer';
import { InterviewCollaborationPanel } from '@/components/interview-kits/InterviewCollaborationPanel';
import { ScorecardComparisonView } from '@/components/interview-kits/ScorecardComparisonView';
import { TranscriptSegment } from '@/lib/whisper';

interface InterviewKit {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
  stage: { id: string; name: string } | null;
  prepItems: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: number | null;
    order: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    order: number;
    attributes: Array<{
      id: string;
      name: string;
      description: string | null;
      required: boolean;
      order: number;
    }>;
  }>;
}

interface KitScorecard {
  id: string;
  scorerId: string;
  scorerName: string;
  keyTakeaways: string | null;
  privateNotes: string | null;
  otherInterviewerNotes: string | null;
  overallRecommendation: string;
  submittedAt: string;
  ratings: Array<{
    id: string;
    attributeId: string;
    attributeName: string;
    rating: number;
    notes: string | null;
    aiSuggested: number | null;
  }>;
}

interface InterviewData {
  id: string;
  applicationId: string;
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
    resumeUrl: string | null;
    notes: Array<{
      id: string;
      content: string;
      author: { id: string; firstName: string; lastName: string };
      createdAt: string;
    }>;
  };
  job: {
    id: string;
    title: string;
    location: string | null;
    description: string | null;
    stages: Array<{ id: string; name: string; order: number }>;
  };
  application: {
    id: string;
    status: string;
    source: string | null;
    createdAt: string;
  };
  stage: { id: string; name: string } | null;
  recording: {
    id: string;
    videoUrl: string | null;
    audioUrl: string | null;
    duration: number | null;
    status: string;
    recordedAt: string | null;
    transcript: {
      id: string;
      fullText: string;
      segments: any;
    } | null;
  } | null;
  aiSummary: {
    id: string;
    summary: string;
    attributeAnalysis: any;
    recommendation: string;
    recommendationScore: number;
    recommendationReason: string;
    strengths: any;
    concerns: any;
    followUpQuestions: any;
  } | null;
  kitScorecards: KitScorecard[];
  interviewKits: InterviewKit[];
  matchingKit: InterviewKit | null;
}

const TABS = [
  { key: 'scorecard', label: 'Scorecard', icon: ClipboardDocumentListIcon },
  { key: 'prep', label: 'Interview Prep', icon: BookOpenIcon },
  { key: 'resume', label: 'Candidate', icon: DocumentTextIcon },
  { key: 'job', label: 'Job Details', icon: BriefcaseIcon },
  { key: 'recording', label: 'Recording', icon: PlayIcon },
  { key: 'ai', label: 'AI Summary', icon: SparklesIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone Screen',
  VIDEO_INTERVIEW: 'Video Interview',
  VIDEO_INTERVIEW_AUDITION: 'Video Interview + Audition',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  BEHAVIORAL_INTERVIEW: 'Behavioral Interview',
  FINAL_INTERVIEW: 'Final Interview',
  IN_PERSON: 'In-Person',
  ONSITE: 'Onsite',
};

const INTERVIEW_TYPE_ICONS: Record<string, React.ElementType> = {
  PHONE_SCREEN: PhoneIcon,
  VIDEO_INTERVIEW: VideoCameraIcon,
  VIDEO_INTERVIEW_AUDITION: VideoCameraIcon,
  TECHNICAL_INTERVIEW: VideoCameraIcon,
  BEHAVIORAL_INTERVIEW: VideoCameraIcon,
  FINAL_INTERVIEW: BuildingOfficeIcon,
  IN_PERSON: BuildingOfficeIcon,
  ONSITE: BuildingOfficeIcon,
};

export default function InterviewKitPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>('scorecard');
  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInterview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`);
      if (!res.ok) throw new Error('Failed to load interview');
      const json = await res.json();
      setData(json);
      setError(null);

      // Auto-navigate based on state
      if (json.aiSummary) {
        setActiveTab('ai');
      } else if (json.recording) {
        setActiveTab('recording');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchInterview();
  }, [fetchInterview]);

  const handleScorecardSubmitted = () => {
    fetchInterview();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger-600">{error || 'Interview not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-brand-600 hover:text-brand-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const isPastInterview = isPast(new Date(data.scheduledAt));
  const TypeIcon = INTERVIEW_TYPE_ICONS[data.type] || VideoCameraIcon;
  const hasSubmittedScorecard = data.kitScorecards.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {/* Mobile-optimized header */}
            <div className="flex flex-col gap-4">
              {/* Top row: back button + candidate info */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/applications/${data.applicationId}`}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    {data.candidate.name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <BriefcaseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{data.job.title}</span>
                    </span>
                    {data.stage && (
                      <>
                        <span className="text-gray-300 hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{data.stage.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons row - responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Interview Info - show on mobile too */}
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <TypeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                    <span className="hidden sm:inline">{INTERVIEW_TYPE_LABELS[data.type] || data.type}</span>
                    <span className="sm:hidden">{data.stage?.name || 'Interview'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                    {format(new Date(data.scheduledAt), 'MMM d')}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                    {format(new Date(data.scheduledAt), 'h:mm a')}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Call Candidate Button (for phone screens) */}
                  {data.type === 'PHONE_SCREEN' && data.candidate.phone && !isPastInterview && (
                    <>
                      <a
                        href={`tel:${data.candidate.phone}`}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors text-sm sm:text-base flex-1 sm:flex-none justify-center"
                      >
                        <PhoneIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden sm:inline">Call</span> {data.candidate.phone}
                      </a>
                      <a
                        href={`zoomphonecall://${data.candidate.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm"
                        title="Call via Zoom Phone"
                      >
                        <VideoCameraIcon className="h-4 w-4" />
                        Zoom
                      </a>
                    </>
                  )}

                  {/* Join Meeting Button */}
                  {data.meetingLink && !isPastInterview && (
                    <a
                      href={data.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm sm:text-base"
                    >
                      <VideoCameraIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      Join Meeting
                    </a>
                  )}

                  {/* Scorecard Status */}
                  {hasSubmittedScorecard && (
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-success-50 text-success-700 rounded-lg text-xs sm:text-sm font-medium">
                      <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Scorecard</span> Submitted
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs - icons only on mobile, full labels on sm+ */}
            <div className="mt-4 -mb-px">
              <nav className="flex justify-between sm:justify-start sm:gap-6">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  const isDisabled =
                    (tab.key === 'recording' && !data.recording) ||
                    (tab.key === 'ai' && !data.aiSummary);

                  if (isDisabled) return null;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      title={tab.label}
                      className={`
                        flex items-center gap-2 py-3 px-2 sm:px-1 border-b-2 text-sm font-medium transition-colors
                        ${
                          isActive
                            ? 'border-brand-500 text-brand-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {tab.key === 'scorecard' && hasSubmittedScorecard && (
                        <span className="ml-1 w-2 h-2 bg-success-500 rounded-full" />
                      )}
                      {tab.key === 'ai' && data.aiSummary && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          AI
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'scorecard' && (
          <ScorecardTab
            data={data}
            onScorecardSubmitted={handleScorecardSubmitted}
          />
        )}
        {activeTab === 'prep' && <PrepTab data={data} />}
        {activeTab === 'resume' && <ResumeTab data={data} />}
        {activeTab === 'job' && <JobTab data={data} />}
        {activeTab === 'recording' && <RecordingTab data={data} />}
        {activeTab === 'ai' && <AISummaryTab data={data} />}
      </div>
    </div>
  );
}

function ScorecardTab({
  data,
  onScorecardSubmitted,
}: {
  data: InterviewData;
  onScorecardSubmitted: () => void;
}) {
  const [viewMode, setViewMode] = useState<'my-scorecard' | 'compare'>('my-scorecard');
  const isPastInterview = isPast(new Date(data.scheduledAt));
  const kit = data.matchingKit;
  const hasMultipleScorecards = data.kitScorecards.length > 1;

  if (!kit) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No Interview Kit Configured
        </h3>
        <p className="text-gray-500">
          An interview kit has not been set up for this interview type.
        </p>
        <Link
          href={`/jobs/${data.job.id}/setup/interview-kits`}
          className="inline-flex items-center gap-2 mt-4 text-brand-600 hover:text-brand-700"
        >
          Configure Interview Kits
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle - show when multiple scorecards exist */}
      {hasMultipleScorecards && (
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('my-scorecard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'my-scorecard'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Scorecard
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'compare'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Compare All ({data.kitScorecards.length})
            </button>
          </div>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'my-scorecard' ? (
        <InterviewKitScorecard
          interviewId={data.id}
          kit={kit}
          existingScorecard={data.kitScorecards[0] || null}
          aiSummary={data.aiSummary}
          onSubmit={onScorecardSubmitted}
          interviewerName={data.interviewer.name}
          isUpcoming={!isPastInterview}
        />
      ) : (
        <ScorecardComparisonView interviewId={data.id} />
      )}
    </div>
  );
}

function PrepTab({ data }: { data: InterviewData }) {
  const kit = data.matchingKit;

  if (!kit || kit.prepItems.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <BookOpenIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No Interview Prep
        </h3>
        <p className="text-gray-500">
          Interview preparation content has not been set up for this interview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prep Items */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Interview Preparation
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {kit.name} • {kit.duration} minutes
            {kit.includesAudition && ' • Includes Audition'}
          </p>
        </div>
        <div className="divide-y">
          {kit.prepItems.map((item, index) => (
            <div key={item.id} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center font-medium text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    {item.duration && (
                      <span className="text-sm text-gray-400">
                        {item.duration} min
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidate Quick Info */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Candidate Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name</span>
            <p className="font-medium mt-0.5">{data.candidate.name}</p>
          </div>
          <div>
            <span className="text-gray-500">Email</span>
            <p className="font-medium mt-0.5">{data.candidate.email}</p>
          </div>
          {data.candidate.phone && (
            <div>
              <span className="text-gray-500">Phone</span>
              <a
                href={`tel:${data.candidate.phone}`}
                className="flex items-center gap-1.5 font-medium mt-0.5 text-brand-600 hover:text-brand-700"
              >
                <PhoneIcon className="h-4 w-4" />
                {data.candidate.phone}
              </a>
            </div>
          )}
          <div>
            <span className="text-gray-500">Stage</span>
            <p className="font-medium mt-0.5">{data.stage?.name || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Recent Notes */}
      {data.candidate.notes.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Notes</h3>
          <div className="space-y-3">
            {data.candidate.notes.slice(0, 5).map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">{note.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {note.author.firstName} {note.author.lastName} •{' '}
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

function ResumeTab({ data }: { data: InterviewData }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Candidate Info Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="h-10 w-10 text-brand-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {data.candidate.name}
            </h2>
            <p className="text-gray-500 mt-1">{data.candidate.email}</p>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            {data.candidate.linkedinUrl && (
              <a
                href={data.candidate.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="LinkedIn"
              >
                <LinkIcon className="h-5 w-5" />
              </a>
            )}
            <a
              href={`mailto:${data.candidate.email}`}
              className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Email"
            >
              <EnvelopeIcon className="h-5 w-5" />
            </a>
            {data.candidate.phone && (
              <a
                href={`tel:${data.candidate.phone}`}
                className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Phone"
              >
                <PhoneIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>

        {/* Application Info */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Application</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium">{data.application.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Source</dt>
              <dd className="font-medium">{data.application.source || 'Direct'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Applied</dt>
              <dd className="font-medium">
                {format(new Date(data.application.createdAt), 'MMM d, yyyy')}
              </dd>
            </div>
          </dl>
          <div className="mt-4 pt-4 border-t">
            <Link
              href={`/candidates/${data.candidate.id}`}
              className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1"
            >
              View Full Profile
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Resume Viewer */}
      <div className="lg:col-span-2">
        {data.candidate.resumeUrl ? (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b">
              <span className="text-sm font-medium text-gray-700">Resume</span>
              <a
                href={data.candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                Open in new tab
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </div>
            <div className="bg-gray-100" style={{ height: '800px' }}>
              <object
                data={`${data.candidate.resumeUrl}#toolbar=0`}
                type="application/pdf"
                className="w-full h-full"
              >
                <iframe
                  src={`${data.candidate.resumeUrl}#toolbar=0`}
                  className="w-full h-full"
                  title="Resume"
                />
              </object>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-12 text-center">
            <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No Resume Available
            </h3>
            <p className="text-gray-500">
              No resume has been uploaded for this candidate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobTab({ data }: { data: InterviewData }) {
  return (
    <div className="bg-white rounded-xl border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">{data.job.title}</h2>
        {data.job.location && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
            <MapPinIcon className="h-4 w-4" />
            {data.job.location}
          </div>
        )}
      </div>

      <div className="p-6">
        {data.job.description ? (
          <div
            className="prose prose-sm max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.job.description) }}
          />
        ) : (
          <p className="text-gray-500">No job description available.</p>
        )}
      </div>

      {/* Pipeline Stages */}
      {data.job.stages.length > 0 && (
        <div className="px-6 py-4 border-t bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Interview Pipeline
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {data.job.stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    stage.id === data.stage?.id
                      ? 'bg-brand-100 text-brand-700 font-medium'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {stage.name}
                </span>
                {idx < data.job.stages.length - 1 && (
                  <span className="text-gray-300">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordingTab({ data }: { data: InterviewData }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const recording = data.recording;

  // Handle seeking from transcript viewer or collaboration panel
  const handleSeek = (time: number) => {
    setSeekTime(time);
    // Reset after a short delay to allow the player to pick it up
    setTimeout(() => setSeekTime(null), 100);
  };

  if (!recording) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <PlayIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No Recording Available
        </h3>
        <p className="text-gray-500">
          This interview has not been recorded yet.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          To record interviews, enable cloud recording in your Zoom meeting settings.
        </p>
      </div>
    );
  }

  // Parse transcript segments from the stored JSON
  const transcriptSegments: TranscriptSegment[] = recording.transcript?.segments
    ? (typeof recording.transcript.segments === 'string'
        ? JSON.parse(recording.transcript.segments)
        : recording.transcript.segments)
    : [];

  const hasTranscript = transcriptSegments.length > 0;

  return (
    <div className="space-y-6">
      {/* Layout: Player + Transcript side by side when transcript exists */}
      {hasTranscript && recording.status === 'READY' ? (
        <>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Player Column */}
          <div className="space-y-4">
            <InterviewRecordingPlayer
              videoUrl={recording.videoUrl}
              audioUrl={recording.audioUrl}
              duration={recording.duration}
              status={recording.status}
              recordedAt={recording.recordedAt}
              onTimeUpdate={(time) => {
                setCurrentTime(time);
                setIsPlaying(true);
              }}
              onSeek={setCurrentTime}
              seekTo={seekTime}
              onPlayStateChange={setIsPlaying}
            />

            {/* Recording Info */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-gray-500">
                  {recording.duration && (
                    <span>
                      Duration: {Math.floor(recording.duration / 60)}:
                      {String(recording.duration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {recording.recordedAt && (
                    <span>
                      Recorded: {format(new Date(recording.recordedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {recording.videoUrl && (
                    <a
                      href={recording.videoUrl}
                      download
                      className="px-3 py-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      Download Video
                    </a>
                  )}
                  {recording.audioUrl && (
                    <a
                      href={recording.audioUrl}
                      download
                      className="px-3 py-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      Download Audio
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Column */}
          <div className="bg-white rounded-xl border flex flex-col" style={{ height: '600px' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MicrophoneIcon className="h-5 w-5 text-gray-400" />
                Transcript
              </h3>
              <span className="text-sm text-gray-400">
                {recording.transcript?.fullText?.split(' ').length || 0} words
              </span>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <InterviewTranscriptViewer
                segments={transcriptSegments}
                currentTime={currentTime}
                onSeek={handleSeek}
                isPlaying={isPlaying}
              />
            </div>
          </div>
        </div>

        {/* Team Collaboration Panel */}
        <InterviewCollaborationPanel
          interviewId={data.id}
          recordingId={recording.id}
          currentTime={currentTime}
          duration={recording.duration}
          onSeek={handleSeek}
        />
        </>
      ) : (
        <>
          {/* Player only (no transcript) */}
          <InterviewRecordingPlayer
            videoUrl={recording.videoUrl}
            audioUrl={recording.audioUrl}
            duration={recording.duration}
            status={recording.status}
            recordedAt={recording.recordedAt}
          />

          {/* Recording Info */}
          {recording.status === 'READY' && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-gray-500">
                  {recording.duration && (
                    <span>
                      Duration: {Math.floor(recording.duration / 60)}:
                      {String(recording.duration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {recording.recordedAt && (
                    <span>
                      Recorded: {format(new Date(recording.recordedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {recording.videoUrl && (
                    <a
                      href={recording.videoUrl}
                      download
                      className="px-3 py-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      Download Video
                    </a>
                  )}
                  {recording.audioUrl && (
                    <a
                      href={recording.audioUrl}
                      download
                      className="px-3 py-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      Download Audio
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plain text transcript fallback */}
          {recording.transcript?.fullText && !hasTranscript && (
            <div className="bg-white rounded-xl border">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Transcript</h3>
                <span className="text-sm text-gray-400">
                  {recording.transcript.fullText.split(' ').length} words
                </span>
              </div>
              <div className="p-6 max-h-[500px] overflow-auto">
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {recording.transcript.fullText}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AISummaryTab({ data }: { data: InterviewData }) {
  const summary = data.aiSummary;

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No AI Summary Available
        </h3>
        <p className="text-gray-500">
          AI analysis will be available after the recording is processed.
        </p>
      </div>
    );
  }

  const recommendationColors: Record<string, string> = {
    STRONG_YES: 'bg-success-100 text-success-800 border-success-200',
    YES: 'bg-success-50 text-success-700 border-success-100',
    NO: 'bg-danger-50 text-danger-700 border-danger-100',
    STRONG_NO: 'bg-danger-100 text-danger-800 border-danger-200',
  };

  return (
    <div className="space-y-6">
      {/* Recommendation */}
      <div
        className={`rounded-xl border p-6 ${
          recommendationColors[summary.recommendation] || 'bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-75">AI Recommendation</p>
            <p className="text-2xl font-bold mt-1">
              {summary.recommendation.replace('_', ' ')}
            </p>
          </div>
          <div className="text-5xl font-bold opacity-75">
            {summary.recommendationScore}/100
          </div>
        </div>
        <p className="mt-4 text-sm">{summary.recommendationReason}</p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Interview Summary</h3>
        <p className="text-gray-600">{summary.summary}</p>
      </div>

      {/* Strengths & Concerns */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-success-700 mb-3">Strengths</h3>
          {Array.isArray(summary.strengths) && (
            <ul className="space-y-2">
              {summary.strengths.map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircleIcon className="h-5 w-5 text-success-500 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-warning-700 mb-3">Areas of Concern</h3>
          {Array.isArray(summary.concerns) && (
            <ul className="space-y-2">
              {summary.concerns.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 flex items-center justify-center text-warning-500 flex-shrink-0">
                    •
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Follow-up Questions */}
      {Array.isArray(summary.followUpQuestions) &&
        summary.followUpQuestions.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              Suggested Follow-up Questions
            </h3>
            <ol className="space-y-2 list-decimal list-inside">
              {summary.followUpQuestions.map((q: string, i: number) => (
                <li key={i} className="text-sm text-gray-600">
                  {q}
                </li>
              ))}
            </ol>
          </div>
        )}
    </div>
  );
}
