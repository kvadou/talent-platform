'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import {
  CalendarIcon,
  ClockIcon,
  VideoCameraIcon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
  BriefcaseIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

interface Interview {
  id: string;
  scheduledAt: string;
  duration: number;
  type: string;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
    location: string | null;
  };
  stage: {
    id: string;
    name: string;
  } | null;
  applicationId: string;
  scorecard: {
    id: string;
    name: string;
    hasCriteria: boolean;
  } | null;
  feedback: {
    id: string;
    recommendation: string;
    submittedAt: string;
  } | null;
  hasFeedback: boolean;
}

interface InterviewsData {
  interviews: Interview[];
  counts: {
    upcoming: number;
    past: number;
    pending: number;
    total: number;
  };
}

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone Screen',
  VIDEO_INTERVIEW: 'Video Interview',
  VIDEO_INTERVIEW_AUDITION: 'Video + Audition',
  TECHNICAL_INTERVIEW: 'Technical',
  BEHAVIORAL_INTERVIEW: 'Behavioral',
  FINAL_INTERVIEW: 'Final Interview',
  IN_PERSON: 'In-Person',
  ONSITE: 'Onsite',
};

const INTERVIEW_TYPE_ICONS: Record<string, React.ReactNode> = {
  PHONE_SCREEN: <PhoneIcon className="h-4 w-4" />,
  VIDEO_INTERVIEW: <VideoCameraIcon className="h-4 w-4" />,
  VIDEO_INTERVIEW_AUDITION: <VideoCameraIcon className="h-4 w-4" />,
  TECHNICAL_INTERVIEW: <VideoCameraIcon className="h-4 w-4" />,
  BEHAVIORAL_INTERVIEW: <VideoCameraIcon className="h-4 w-4" />,
  FINAL_INTERVIEW: <VideoCameraIcon className="h-4 w-4" />,
  IN_PERSON: <MapPinIcon className="h-4 w-4" />,
  ONSITE: <MapPinIcon className="h-4 w-4" />,
};

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isPast(date)) return formatDistanceToNow(date, { addSuffix: true });
  return format(date, 'EEEE, MMM d');
}

function getRecommendationBadge(recommendation: string) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
    STRONG_HIRE: 'success',
    HIRE: 'success',
    NO_HIRE: 'error',
    STRONG_NO_HIRE: 'error',
  };
  const labels: Record<string, string> = {
    STRONG_HIRE: 'Strong Hire',
    HIRE: 'Hire',
    NO_HIRE: 'No Hire',
    STRONG_NO_HIRE: 'Strong No Hire',
  };
  return (
    <Badge variant={variants[recommendation] || 'neutral'}>
      {labels[recommendation] || recommendation}
    </Badge>
  );
}

export default function InterviewsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams.get('filter');
  const filter = (['upcoming', 'past', 'pending'].includes(filterParam || '')
    ? filterParam
    : 'upcoming') as 'upcoming' | 'past' | 'pending';

  const [data, setData] = useState<InterviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setFilter = (newFilter: 'upcoming' | 'past' | 'pending') => {
    router.push(`/interviews?filter=${newFilter}`);
  };

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews?filter=${filter}`);
      if (!res.ok) throw new Error('Failed to load interviews');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const filters = [
    { key: 'upcoming' as const, label: 'Upcoming', count: data?.counts.upcoming || 0 },
    { key: 'pending' as const, label: 'Pending Feedback', count: data?.counts.pending || 0 },
    { key: 'past' as const, label: 'Past', count: data?.counts.past || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Interviews</h1>
          <p className="text-gray-500 mt-1">
            Manage your scheduled interviews and submit feedback
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                ${filter === f.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`
                  inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${filter === f.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}
                  ${f.key === 'pending' && f.count > 0 ? 'bg-warning-100 text-warning-700' : ''}
                `}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
                <div className="h-8 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-danger-50 text-danger-600 p-4 rounded-lg">
          {error}
        </div>
      ) : data?.interviews.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filter === 'upcoming' && 'No upcoming interviews'}
            {filter === 'pending' && 'No pending feedback'}
            {filter === 'past' && 'No past interviews'}
          </h3>
          <p className="text-gray-500">
            {filter === 'upcoming' && 'You have no interviews scheduled.'}
            {filter === 'pending' && 'All your interview feedback has been submitted!'}
            {filter === 'past' && 'No interview history to display.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewCard({
  interview,
  filter,
}: {
  interview: Interview;
  filter: string;
}) {
  const scheduledDate = new Date(interview.scheduledAt);
  const isPastInterview = isPast(scheduledDate);
  const needsFeedback = isPastInterview && !interview.hasFeedback;

  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="block w-full text-left bg-white rounded-lg border hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Candidate Avatar */}
          <div className="flex-shrink-0 w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
            <UserIcon className="h-5 w-5 text-brand-600" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-gray-900 truncate">
                  {interview.candidate.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                  <BriefcaseIcon className="h-4 w-4" />
                  <span className="truncate">{interview.job.title}</span>
                  {interview.stage && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{interview.stage.name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status / Action */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {interview.hasFeedback && interview.feedback ? (
                  getRecommendationBadge(interview.feedback.recommendation)
                ) : needsFeedback ? (
                  <Badge variant="warning" className="animate-pulse">
                    <ExclamationCircleIcon className="h-3.5 w-3.5 mr-1" />
                    Submit Feedback
                  </Badge>
                ) : (
                  <Badge variant="neutral">
                    {INTERVIEW_TYPE_LABELS[interview.type] || interview.type}
                  </Badge>
                )}
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Date/Time Row */}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <span className={isToday(scheduledDate) ? 'font-medium text-brand-600' : ''}>
                  {getDateLabel(interview.scheduledAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <span>{format(scheduledDate, 'h:mm a')}</span>
                <span className="text-gray-400">({interview.duration} min)</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500">
                {INTERVIEW_TYPE_ICONS[interview.type] || <VideoCameraIcon className="h-4 w-4" />}
                <span>{INTERVIEW_TYPE_LABELS[interview.type] || interview.type}</span>
              </div>
            </div>

            {/* Meeting Link */}
            {interview.meetingLink && !isPastInterview && (
              <div className="mt-2">
                <a
                  href={interview.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
                >
                  <VideoCameraIcon className="h-4 w-4" />
                  Join Meeting
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
