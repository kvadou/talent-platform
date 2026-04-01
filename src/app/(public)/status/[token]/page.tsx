'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { AlertModal } from '@/components/ui/AlertModal';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  VideoCameraIcon,
  UserIcon,
  DocumentTextIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  GiftIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { EmbeddedScheduler } from '@/components/scheduling/EmbeddedScheduler';
import dynamic from 'next/dynamic';

const CandidatePuzzleWidget = dynamic(
  () => import('@/components/chess/CandidatePuzzleWidget').then(m => ({ default: m.CandidatePuzzleWidget })),
  { ssr: false }
);

// Brand Assets
const BRAND_LOGO = 'https://placehold.co/200x60/3BA9DA/white?text=Acme+Talent';

interface Stage {
  id: string;
  name: string;
  order: number;
  defaultInterviewType?: string | null;
}

interface StageHistoryItem {
  id: string;
  stageId: string;
  movedAt: string;
  stage: {
    name: string;
    order: number;
  };
}

interface Interview {
  id: string;
  scheduledAt: string;
  duration: number;
  type: string;
  location: string | null;
  meetingLink: string | null;
  interviewer: {
    firstName: string;
    lastName: string;
  };
}

interface Message {
  id: string;
  subject: string;
  sentAt: string;
}

interface Application {
  id: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  createdAt: string;
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  job: {
    id: string;
    title: string;
    location: string | null;
    market: {
      name: string;
    };
  };
  currentStage: Stage;
  allStages: Stage[];
  stageHistory: StageHistoryItem[];
  interviews: Interview[];
  messages: Message[];
  offer: {
    id: string;
    status: string;
    salary: number;
    startDate: string;
    expiresAt: string;
  } | null;
}

// Stage info mapping
const STAGE_INFO: Record<string, {
  icon: React.ElementType;
  title: string;
  description: string;
  tips: string[];
  action?: { label: string; href?: string; isScheduling?: boolean };
}> = {
  'Application Review': {
    icon: DocumentTextIcon,
    title: 'Application Under Review',
    description: 'Our team is carefully reviewing your application and qualifications. We\'ll be in touch soon!',
    tips: [
      'Make sure your contact information is up to date',
      'Check your email regularly (including spam folder)',
      'Review the job description to prepare for potential questions',
    ],
  },
  'Preliminary Phone Screen': {
    icon: PhoneIcon,
    title: 'Phone Screen Interview',
    description: 'Schedule a brief call with our team to discuss your background and interest in the role.',
    tips: [
      'Find a quiet place with good phone reception',
      'Have your resume handy for reference',
      'Prepare questions about the role and company',
    ],
    action: { label: 'Schedule Your Call', isScheduling: true },
  },
  'Hiring Manager Interview': {
    icon: UserIcon,
    title: 'Hiring Manager Interview',
    description: 'Meet with the hiring manager to dive deeper into your experience and discuss the role in detail.',
    tips: [
      'Research Acme Talent and our mission',
      'Prepare specific examples from your experience',
      'Think about how you can contribute to our team',
      'Have questions ready about the team and day-to-day responsibilities',
    ],
  },
  'Face to Face': {
    icon: VideoCameraIcon,
    title: 'Video Interview',
    description: 'Join us for an in-depth interview where you\'ll meet more team members and get a feel for our culture.',
    tips: [
      'Dress professionally but comfortably',
      'Test your video connection 10 minutes early',
      'Be prepared for scenario-based questions',
      'Show enthusiasm for teaching kids and making learning fun',
    ],
  },
  'Reference Check': {
    icon: CheckCircleIcon,
    title: 'Reference Check',
    description: 'We\'re almost there! We\'ll be reaching out to your references to learn more about your amazing work.',
    tips: [
      'Give your references a heads up that we\'ll be calling',
      'Ensure contact information is current',
      'Choose references who can speak to relevant experience',
    ],
  },
  'Offer': {
    icon: GiftIcon,
    title: 'Offer Stage',
    description: 'Congratulations! You\'ve made it to the final stage. We\'re preparing an offer for you.',
    tips: [
      'Review the offer details carefully',
      'Don\'t hesitate to ask clarifying questions',
      'We\'re excited to potentially welcome you to the team!',
    ],
  },
};

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  PHONE_SCREEN: 'Phone Screen',
  VIDEO_INTERVIEW: 'Video Interview',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  BEHAVIORAL_INTERVIEW: 'Behavioral Interview',
  FINAL_INTERVIEW: 'Final Interview',
  ONSITE: 'On-Site Interview'
};

const INTERVIEW_TYPE_ICONS: Record<string, React.ElementType> = {
  PHONE_SCREEN: PhoneIcon,
  VIDEO_INTERVIEW: VideoCameraIcon,
  TECHNICAL_INTERVIEW: DocumentTextIcon,
  BEHAVIORAL_INTERVIEW: UserIcon,
  FINAL_INTERVIEW: UserIcon,
  ONSITE: BuildingOfficeIcon,
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(dateStr));
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateStr));
}

function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr));
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function generateGoogleCalendarUrl(interview: Interview, jobTitle: string, candidatePhone?: string | null): string {
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + interview.duration * 60 * 1000);

  const formatForCal = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const isPhoneScreen = interview.type === 'PHONE_SCREEN';
  const stcPhone = '(332) 345-4168';

  let details = '';
  if (isPhoneScreen) {
    details = `Phone Screen for ${jobTitle} at Acme Talent\n\nWe'll call you${candidatePhone ? ` at ${candidatePhone}` : ''} from ${stcPhone}.\n\nPlease be in a quiet place with good reception.`;
  } else if (interview.meetingLink) {
    details = `Join meeting: ${interview.meetingLink}`;
  }

  const title = isPhoneScreen
    ? `Acme Talent Phone Screen: ${jobTitle}`
    : `Acme Talent Interview: ${jobTitle}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatForCal(start)}/${formatForCal(end)}`,
    details,
    location: interview.meetingLink || interview.location || ''
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

// Progress tracker step
function ProgressStep({
  stage,
  isCompleted,
  isCurrent,
  isLast,
}: {
  stage: Stage;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center flex-1 last:flex-initial">
      <div className="flex flex-col items-center">
        {/* Circle */}
        <div
          className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
            isCompleted && !isCurrent
              ? 'bg-[#34B256]'
              : isCurrent
                ? 'bg-[#6A469D] ring-4 ring-[#6A469D]/20'
                : 'bg-white border-2 border-[#2D2F8E]/30'
          }`}
        >
          {isCompleted && !isCurrent ? (
            <CheckCircleSolidIcon className="w-5 h-5 text-white" />
          ) : isCurrent ? (
            <div className="w-3 h-3 rounded-full bg-white" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-[#2D2F8E]/20" />
          )}
        </div>
        {/* Label */}
        <span className={`mt-2 text-[11px] font-medium text-center max-w-[72px] leading-tight ${
          isCurrent ? 'text-[#6A469D] font-semibold' : isCompleted ? 'text-[#34B256]' : 'text-neutral-400'
        }`}>
          {stage.name}
        </span>
      </div>
      {/* Connector line */}
      {!isLast && (
        <div className={`flex-1 h-0.5 mx-1.5 mt-[-20px] rounded-full transition-colors ${
          isCompleted && !isCurrent ? 'bg-[#34B256]' : 'bg-neutral-200'
        }`} />
      )}
    </div>
  );
}

export default function CandidatePortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [rescheduleInterview, setRescheduleInterview] = useState<Interview | null>(null);
  const [cancellingInterviewId, setCancellingInterviewId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<Interview | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Engagement tracking
  const sessionStart = useRef(Date.now());
  const hasTrackedView = useRef(false);

  const trackEngagement = useCallback(async (type: 'view' | 'heartbeat' | 'leave', data?: Record<string, unknown>) => {
    if (!token) return;
    try {
      await fetch(`/api/public/applications/${token}/engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data })
      });
    } catch {
      // Silent fail for tracking
    }
  }, [token]);

  useEffect(() => {
    if (token && !hasTrackedView.current && !loading && application) {
      hasTrackedView.current = true;
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      trackEngagement('view', { timezone: detectedTimezone });
    }
  }, [token, loading, application, trackEngagement]);

  useEffect(() => {
    if (!token || !application) return;

    const heartbeat = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - sessionStart.current) / 1000);
      trackEngagement('heartbeat', { timeSpent });
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const timeSpent = Math.floor((Date.now() - sessionStart.current) / 1000);
        trackEngagement('leave', { timeSpent });
      }
    };

    const handleBeforeUnload = () => {
      const timeSpent = Math.floor((Date.now() - sessionStart.current) / 1000);
      trackEngagement('leave', { timeSpent });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [token, application, trackEngagement]);

  useEffect(() => {
    if (!token) return;

    async function fetchApplication() {
      try {
        const res = await fetch(`/api/public/applications/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to load application');
        }
        const data = await res.json();
        setApplication(data.application);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchApplication();
  }, [token]);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/public/applications/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to withdraw');
      }

      const refreshRes = await fetch(`/api/public/applications/${token}`);
      const data = await refreshRes.json();
      setApplication(data.application);
      setShowWithdrawConfirm(false);
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCancelInterview = async (interview: Interview) => {
    setCancellingInterviewId(interview.id);
    try {
      const res = await fetch(`/api/public/applications/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: interview.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel interview');
      }

      const refreshRes = await fetch(`/api/public/applications/${token}`);
      const data = await refreshRes.json();
      setApplication(data.application);
      setShowCancelConfirm(null);
      setAlertMsg('Interview cancelled successfully.');
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : 'Failed to cancel interview');
    } finally {
      setCancellingInterviewId(null);
    }
  };

  const handlePuzzleEvent = useCallback((event: 'attempted' | 'solved', streak?: number) => {
    trackEngagement('heartbeat', { puzzleEvent: event, streak });
  }, [trackEngagement]);

  const upcomingInterviews = application?.interviews.filter(
    i => new Date(i.scheduledAt) > new Date()
  ) || [];

  const pastInterviews = application?.interviews.filter(
    i => new Date(i.scheduledAt) <= new Date()
  ) || [];

  const currentStageInfo = application ? STAGE_INFO[application.currentStage.name] : undefined;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8FBFF] flex items-center justify-center">
        <div className="text-center">
          <Image src={BRAND_LOGO} alt="Acme Talent" width={280} height={80} unoptimized className="h-14 w-auto mx-auto mb-8" />
          <div className="w-10 h-10 border-3 border-[#6A469D]/20 border-t-[#6A469D] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#2D2F8E]/60 text-sm font-medium">Loading your application...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !application) {
    return (
      <div className="min-h-screen bg-[#E8FBFF] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-10 max-w-md w-full text-center">
          <Image src={BRAND_LOGO} alt="Acme Talent" width={250} height={70} unoptimized className="h-12 w-auto mx-auto mb-8" />
          <div className="w-16 h-16 bg-[#E8FBFF] rounded-xl flex items-center justify-center mx-auto mb-5">
            <DocumentTextIcon className="w-8 h-8 text-[#50C8DF]" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Application Not Available</h1>
          <p className="text-neutral-500 text-sm mb-6">
            This link is no longer active. The position may have been filled or your application was updated.
          </p>
          <p className="text-neutral-400 text-xs mb-6">
            Questions? Reach out to{' '}
            <a href="mailto:recruiting@acmetalent.com" className="text-[#6A469D] font-medium hover:underline">
              recruiting@acmetalent.com
            </a>
          </p>
          <Link
            href="/careers"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#6A469D] text-white font-semibold rounded-[10px] hover:bg-[#5a3a87] transition-colors text-sm"
          >
            View Open Positions
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isWithdrawn = application.status === 'WITHDRAWN';
  const isRejected = application.status === 'REJECTED';
  const isHired = application.status === 'HIRED';

  return (
    <div className="min-h-screen bg-[#E8FBFF] font-[family-name:var(--font-poppins)]">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        {/* Gradient background: teal → purple */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2D2F8E] via-[#6A469D] to-[#2D2F8E]" />

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          {/* Top bar: logo + status badge */}
          <div className="flex items-center justify-between mb-6">
            <Link href="https://acmetalent.com">
              <Image
                src={BRAND_LOGO}
                alt="Acme Talent"
                width={200}
                height={56}
                unoptimized
                className="h-10 sm:h-11 object-contain hover:opacity-90 transition-opacity"
              />
            </Link>
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide ${
              isWithdrawn || isRejected
                ? 'bg-white/20 text-white/80'
                : isHired
                  ? 'bg-[#34B256]/20 text-white'
                  : 'bg-white/20 text-white backdrop-blur-sm'
            }`}>
              {application.statusLabel}
            </span>
          </div>

          {/* Greeting + job info */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
              Hi, {application.candidate.firstName}!
            </h1>
            <p className="text-white/70 text-sm mb-4">
              Welcome to your application portal
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/90">
              <span className="text-base font-semibold">{application.job.title}</span>
              <span className="text-white/40">|</span>
              <span className="text-sm text-white/70">
                {application.job.location || application.job.market.name}
              </span>
              <span className="text-white/40">|</span>
              <span className="text-sm text-white/70">
                Applied {formatDate(application.createdAt)}
              </span>
            </div>
          </div>

          {/* Progress tracker - pushed down to overlap into main content */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5 -mb-10 relative z-20">
            <div className="flex items-start justify-between px-2 overflow-x-auto">
              {application.allStages.map((stage, idx) => {
                const isCompleted = application.stageHistory.some(h => h.stageId === stage.id);
                const isCurrent = stage.id === application.currentStage.id;

                return (
                  <ProgressStep
                    key={stage.id}
                    stage={stage}
                    isCompleted={isCompleted}
                    isCurrent={isCurrent && !isWithdrawn && !isRejected}
                    isLast={idx === application.allStages.length - 1}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left column - 3/5 width */}
          <div className="lg:col-span-3 space-y-6">

            {/* YOUR NEXT STEP CARD */}
            {currentStageInfo && !isWithdrawn && !isRejected && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                {/* Card header with purple left accent */}
                <div className="border-l-4 border-[#6A469D] px-6 py-5">
                  <p className="text-xs font-semibold text-[#6A469D] uppercase tracking-widest mb-1">
                    Your Next Step
                  </p>
                  <h2 className="text-xl font-bold text-neutral-900">
                    {currentStageInfo.title}
                  </h2>
                </div>

                <div className="px-6 pb-6">
                  {/* If interview is scheduled, show date/time prominently */}
                  {currentStageInfo.action?.isScheduling && upcomingInterviews.length > 0 && (
                    <div className="bg-[#E8FBFF] rounded-xl p-4 mb-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                        <CalendarDaysIcon className="w-6 h-6 text-[#6A469D]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">
                          {formatShortDate(upcomingInterviews[0].scheduledAt)}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {formatTime(upcomingInterviews[0].scheduledAt)} &middot; {upcomingInterviews[0].duration} minutes
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-neutral-500 text-sm mb-5 leading-relaxed">
                    {currentStageInfo.action?.isScheduling && upcomingInterviews.length > 0
                      ? `Your call is confirmed! Need to change the time? Use the button below.`
                      : currentStageInfo.description}
                  </p>

                  {/* Preparation checklist */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">
                      Prepare by
                    </h4>
                    <ul className="space-y-2.5">
                      {currentStageInfo.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-700">
                          <CheckCircleSolidIcon className="w-5 h-5 text-[#34B256] flex-shrink-0 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Primary CTA */}
                  {currentStageInfo.action?.isScheduling && (
                    upcomingInterviews.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={generateGoogleCalendarUrl(upcomingInterviews[0], application.job.title, application.candidate.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#6A469D] text-white font-semibold rounded-[10px] hover:bg-[#5a3a87] transition-colors text-sm shadow-sm"
                        >
                          <CalendarDaysIcon className="w-5 h-5" />
                          Add to Calendar
                        </a>
                        <button
                          onClick={() => setRescheduleInterview(upcomingInterviews[0])}
                          className="flex items-center justify-center gap-2 px-5 py-3 bg-neutral-100 text-neutral-700 font-medium rounded-[10px] hover:bg-neutral-200 transition-colors text-sm"
                        >
                          Reschedule
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowScheduler(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#6A469D] text-white font-semibold rounded-[10px] hover:bg-[#5a3a87] transition-colors text-sm shadow-sm"
                      >
                        <CalendarDaysIcon className="w-5 h-5" />
                        {currentStageInfo.action.label}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* UPCOMING INTERVIEWS (separate from Next Step when there are multiple) */}
            {upcomingInterviews.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <CalendarDaysIcon className="w-5 h-5 text-[#50C8DF]" />
                    Upcoming Interviews
                  </h3>
                </div>
                <div className="divide-y divide-neutral-100">
                  {upcomingInterviews.slice(1).map(interview => {
                    const Icon = INTERVIEW_TYPE_ICONS[interview.type] || VideoCameraIcon;
                    return (
                      <div key={interview.id} className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#E8FBFF] flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-[#50C8DF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#6A469D] uppercase tracking-wide">
                              {INTERVIEW_TYPE_LABELS[interview.type] || interview.type}
                            </p>
                            <p className="font-semibold text-neutral-900 text-sm mt-0.5">
                              {formatDateTime(interview.scheduledAt)}
                            </p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {interview.duration} min with {interview.interviewer.firstName}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {interview.meetingLink && (
                                <a
                                  href={interview.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6A469D] text-white text-xs font-medium rounded-lg hover:bg-[#5a3a87] transition-colors"
                                >
                                  <VideoCameraIcon className="w-3.5 h-3.5" />
                                  Join Call
                                </a>
                              )}
                              <a
                                href={generateGoogleCalendarUrl(interview, application.job.title, application.candidate.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-600 text-xs font-medium rounded-lg hover:bg-neutral-200 transition-colors"
                              >
                                Add to Calendar
                              </a>
                              <button
                                onClick={() => setShowCancelConfirm(interview)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-neutral-400 text-xs font-medium rounded-lg hover:bg-danger-50 hover:text-danger-500 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ACTIVITY TIMELINE */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-[#6A469D]" />
                  Activity
                </h3>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  {/* Completed interviews */}
                  {pastInterviews.map(interview => (
                    <div key={interview.id} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-[#34B256]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircleSolidIcon className="w-4 h-4 text-[#34B256]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {INTERVIEW_TYPE_LABELS[interview.type] || interview.type} completed
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatDateTime(interview.scheduledAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Upcoming interviews in timeline */}
                  {upcomingInterviews.map(interview => (
                    <div key={`timeline-${interview.id}`} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-[#50C8DF]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CalendarDaysIcon className="w-4 h-4 text-[#50C8DF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {INTERVIEW_TYPE_LABELS[interview.type] || interview.type} scheduled
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatDateTime(interview.scheduledAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Stage history */}
                  {application.stageHistory.slice().reverse().map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        idx === 0 ? 'bg-[#6A469D]/10' : 'bg-neutral-100'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          idx === 0 ? 'bg-[#6A469D]' : 'bg-neutral-300'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          Moved to {item.stage.name}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {formatDateTime(item.movedAt)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Application submitted */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-[#34B256]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircleSolidIcon className="w-4 h-4 text-[#34B256]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">
                        Application submitted
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatDateTime(application.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdraw button */}
            {application.status === 'ACTIVE' && (
              <button
                onClick={() => setShowWithdrawConfirm(true)}
                className="w-full px-4 py-2 text-xs text-neutral-300 hover:text-danger-400 hover:bg-white rounded-[10px] transition-colors"
              >
                Withdraw Application
              </button>
            )}
          </div>

          {/* Right column - 2/5 width */}
          <div className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start space-y-6">
            {/* Chess Puzzle Widget */}
            {application.status === 'ACTIVE' && (
              <CandidatePuzzleWidget
                applicationToken={token}
                onPuzzleEvent={handlePuzzleEvent}
                className="shadow-sm border border-neutral-200"
              />
            )}
          </div>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-neutral-200 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-neutral-400 text-xs mb-1">
            Questions about your application?
          </p>
          <a
            href="mailto:recruiting@acmetalent.com"
            className="inline-flex items-center gap-1.5 text-[#6A469D] text-sm font-medium hover:underline"
          >
            <EnvelopeIcon className="w-4 h-4" />
            recruiting@acmetalent.com
          </a>
          <p className="text-neutral-300 text-xs mt-4">
            &copy; {new Date().getFullYear()} Acme Talent
          </p>
        </div>
      </footer>

      {/* ===== MODALS ===== */}

      {/* Withdraw Confirmation */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="w-12 h-12 bg-[#F79A30]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-[#F79A30]" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 text-center mb-2">
              Withdraw Application?
            </h3>
            <p className="text-neutral-500 text-center text-sm mb-6">
              Are you sure you want to withdraw your application for <strong>{application.job.title}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="flex-1 px-4 py-2.5 text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 bg-danger-600 text-white rounded-[10px] hover:bg-danger-700 font-medium disabled:opacity-50 transition-colors text-sm"
              >
                {withdrawing ? 'Withdrawing...' : 'Yes, Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Interview Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="w-12 h-12 bg-[#F79A30]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-[#F79A30]" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 text-center mb-2">
              Cancel Interview?
            </h3>
            <p className="text-neutral-500 text-center text-sm mb-6">
              Are you sure you want to cancel your interview scheduled for{' '}
              <strong>{formatDateTime(showCancelConfirm.scheduledAt)}</strong>?
              The interviewer will be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 px-4 py-2.5 text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 font-medium transition-colors text-sm"
              >
                Keep It
              </button>
              <button
                onClick={() => handleCancelInterview(showCancelConfirm)}
                disabled={!!cancellingInterviewId}
                className="flex-1 px-4 py-2.5 bg-danger-600 text-white rounded-[10px] hover:bg-danger-700 font-medium disabled:opacity-50 transition-colors text-sm"
              >
                {cancellingInterviewId ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Modals */}
      <EmbeddedScheduler
        applicationToken={token}
        isModal
        isOpen={showScheduler}
        onClose={() => setShowScheduler(false)}
        jobTitle={application.job.title}
        duration={30}
        stageName={application.currentStage.name.replace(/^\d+\.\s*/, '')}
        locationType={
          application.currentStage.defaultInterviewType === 'VIDEO_INTERVIEW' ? 'GOOGLE_MEET'
            : application.currentStage.defaultInterviewType === 'ONSITE' ? 'IN_PERSON'
            : application.currentStage.defaultInterviewType === 'PHONE_SCREEN' ? 'PHONE'
            : undefined
        }
        onBooked={() => {
          window.location.reload();
        }}
      />

      {rescheduleInterview && (
        <EmbeddedScheduler
          applicationToken={token}
          isModal
          isOpen={!!rescheduleInterview}
          onClose={() => setRescheduleInterview(null)}
          jobTitle={application.job.title}
          duration={rescheduleInterview.duration}
          locationType={rescheduleInterview.type === 'VIDEO_INTERVIEW' ? 'GOOGLE_MEET' : rescheduleInterview.type === 'ONSITE' ? 'IN_PERSON' : 'PHONE'}
          interviewId={rescheduleInterview.id}
          currentScheduledTime={rescheduleInterview.scheduledAt}
          interviewerName={`${rescheduleInterview.interviewer.firstName} ${rescheduleInterview.interviewer.lastName}`}
          onBooked={() => {
            window.location.reload();
          }}
        />
      )}

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />
    </div>
  );
}
