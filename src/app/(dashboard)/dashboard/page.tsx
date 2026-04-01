'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, ApplicationStageBadge } from '@/components/ui/Badge';
import {
  BriefcaseIcon,
  UsersIcon,
  CalendarIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  VideoCameraIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  StarIcon,
  ArrowRightIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { Route } from 'next';
import { SlaAlertsCard } from '@/components/dashboard/SlaAlertsCard';

interface DashboardData {
  user: {
    firstName: string;
    lastName: string;
    role: string;
  };
  stats: {
    activeJobs: number;
    totalApplications: number;
    upcomingInterviews: number;
    interviewsToday: number;
  };
  myInterviews: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    duration: number;
    location?: string;
    meetingLink?: string;
    candidate: { name: string };
    job: { id: string; title: string; location?: string };
    applicationId: string;
    hasScorecard: boolean;
    scorecardName?: string;
    hasFeedback: boolean;
  }>;
  pendingScorecards: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    candidate: { name: string };
    job: { id: string; title: string };
    applicationId: string;
    scorecardId?: string;
    scorecardName?: string;
  }>;
  myTasks: Array<{
    id: string;
    title: string;
    description?: string;
    priority: string;
    status: string;
    dueAt?: string;
    application?: {
      id: string;
      candidate: { firstName: string; lastName: string };
      job: { title: string };
    };
    job?: { title: string };
  }>;
  taskStats: {
    needsDecision: number;
    toSchedule: number;
    offers: number;
    overdue: number;
    total: number;
  };
  myJobs: Array<{
    id: string;
    title: string;
    role: string;
    applicationCount: number;
  }>;
  recentApplications: Array<{
    id: string;
    createdAt: string;
    candidate: { name: string };
    job: { title: string; location?: string };
    stage: string;
  }>;
  pipeline: Array<{
    stageId: string;
    stageName: string;
    order: number;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: string;
    user: string | null;
    applicationId: string | null;
    candidateName: string | null;
    jobTitle: string | null;
  }>;
  trends?: {
    applications: { current: number; previous: number; trend: 'up' | 'down' | 'neutral' };
    hires: { current: number; previous: number; trend: 'up' | 'down' | 'neutral' };
    timeToHire: number;
    conversionRate: number;
  };
}

function getInterviewTypeIcon(type: string) {
  switch (type) {
    case 'VIDEO':
      return <VideoCameraIcon className="h-4 w-4 text-cyan-500" />;
    case 'PHONE':
      return <PhoneIcon className="h-4 w-4 text-success-500" />;
    case 'ONSITE':
      return <BuildingOfficeIcon className="h-4 w-4 text-purple-500" />;
    default:
      return <CalendarIcon className="h-4 w-4 text-slate-500" />;
  }
}

function formatInterviewType(type: string) {
  const typeMap: Record<string, string> = {
    PHONE: 'Phone Screen',
    VIDEO: 'Video Interview',
    ONSITE: 'On-site Interview',
    PANEL: 'Panel Interview',
    TECHNICAL: 'Technical Interview',
    CULTURE_FIT: 'Culture Fit',
    EXECUTIVE: 'Executive Interview',
  };
  return typeMap[type] || type;
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isPastDue(dateString?: string) {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'APPLICATION_CREATED':
      return <UsersIcon className="h-4 w-4 text-purple-500" />;
    case 'STAGE_CHANGE':
      return <ArrowRightIcon className="h-4 w-4 text-cyan-500" />;
    case 'EMAIL_SENT':
      return <PaperAirplaneIcon className="h-4 w-4 text-cyan-500" />;
    case 'INTERVIEW_SCHEDULED':
    case 'INTERVIEW_COMPLETED':
      return <CalendarIcon className="h-4 w-4 text-success-500" />;
    case 'FEEDBACK_SUBMITTED':
      return <StarIcon className="h-4 w-4 text-yellow-500" />;
    case 'OFFER_CREATED':
    case 'OFFER_SENT':
    case 'OFFER_ACCEPTED':
      return <DocumentCheckIcon className="h-4 w-4 text-success-500" />;
    case 'NOTE_ADDED':
      return <ClipboardDocumentListIcon className="h-4 w-4 text-slate-500" />;
    default:
      return <ClockIcon className="h-4 w-4 text-slate-400" />;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Failed to load dashboard');
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-96 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <ExclamationCircleIcon className="h-12 w-12 mx-auto text-danger-500 mb-4" />
        <p className="text-danger-600">{error || 'Failed to load dashboard'}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="opacity-0 animate-reveal-1">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-navy-900 tracking-tight">
          {greeting()}, {data.user.firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s what&apos;s happening with your hiring pipeline today.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 opacity-0 animate-reveal-2">
        <Link href="/jobs?status=PUBLISHED" className="block">
          <StatCard
            label="Active Jobs"
            value={data.stats.activeJobs}
            icon={<BriefcaseIcon className="h-5 w-5" />}
          />
        </Link>
        <Link href="/applications" className="block">
          <StatCard
            label="Total Applications"
            value={data.stats.totalApplications}
            icon={<UsersIcon className="h-5 w-5" />}
            change={data.trends ? {
              value: `${data.trends.applications.current > data.trends.applications.previous ? '+' : ''}${data.trends.applications.current - data.trends.applications.previous} vs last month`,
              trend: data.trends.applications.trend,
            } : undefined}
          />
        </Link>
        <Link href="/interviews" className="block">
          <StatCard
            label="My Upcoming Interviews"
            value={data.stats.upcomingInterviews}
            icon={<CalendarIcon className="h-5 w-5" />}
            highlight={data.stats.interviewsToday > 0}
            change={data.stats.interviewsToday > 0 ? {
              value: `${data.stats.interviewsToday} today`,
              trend: 'neutral' as const,
            } : undefined}
          />
        </Link>
        <Link href="/interviews/pending" className="block">
          <StatCard
            label="Pending Scorecards"
            value={data.pendingScorecards.length}
            icon={<ClipboardDocumentListIcon className="h-5 w-5" />}
            highlight={data.pendingScorecards.length > 0}
          />
        </Link>
        <Link href="/admin/reporting" className="block">
          <StatCard
            label="Time to Hire"
            value={data.trends?.timeToHire ? `${data.trends.timeToHire}d` : '\u2014'}
            icon={<ClockIcon className="h-5 w-5" />}
          />
        </Link>
        <Link href="/admin/reporting" className="block">
          <StatCard
            label="Conversion Rate"
            value={data.trends?.conversionRate ? `${data.trends.conversionRate.toFixed(1)}%` : '\u2014'}
            icon={<ArrowRightIcon className="h-5 w-5" />}
          />
        </Link>
      </div>

      {/* SLA Alerts - Attention Required */}
      <div className="opacity-0 animate-reveal-3">
        <SlaAlertsCard />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Interviews */}
          <div className="opacity-0 animate-reveal-3">
            <Card variant="elevated">
              <CardHeader
                title="My Interviews"
                accent="purple"
                action={
                  <Link href="/interviews">
                    <Button variant="ghost" size="sm">
                      See all interviews
                    </Button>
                  </Link>
                }
              />
              <CardContent noPadding>
                {data.myInterviews.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <CalendarIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-600 font-medium">No upcoming interviews</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Your scheduled interviews will appear here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.myInterviews.map((interview) => {
                      const { date, time } = formatDateTime(interview.scheduledAt);
                      const today = isToday(interview.scheduledAt);
                      return (
                        <div
                          key={interview.id}
                          className={`px-5 py-4 ${today ? 'bg-purple-50/50' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <Link
                                  href={`/applications/${interview.applicationId}`}
                                  className="font-semibold text-navy-900 hover:text-purple-700 transition-colors"
                                >
                                  {interview.candidate.name}
                                </Link>
                                {today && (
                                  <Badge variant="purple" size="sm">Today</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                {getInterviewTypeIcon(interview.type)}
                                <span>{formatInterviewType(interview.type)}</span>
                                <span className="text-slate-300">•</span>
                                <span>{interview.job.title}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                <ClockIcon className="h-3.5 w-3.5" />
                                <span>{date} at {time}</span>
                                <span className="text-slate-300">•</span>
                                <span>{interview.duration} min</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {interview.hasFeedback ? (
                                <Badge variant="success" size="sm">
                                  <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                                  Submitted
                                </Badge>
                              ) : interview.hasScorecard ? (
                                <Link href={`/applications/${interview.applicationId}` as Route}>
                                  <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                                    <StarIcon className="h-4 w-4 mr-1" />
                                    Fill out scorecard
                                  </Button>
                                </Link>
                              ) : (
                                <Link href={`/applications/${interview.applicationId}`}>
                                  <Button variant="ghost" size="sm">
                                    View
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pending Scorecards */}
          {data.pendingScorecards.length > 0 && (
            <div className="opacity-0 animate-reveal-4">
              <Card variant="elevated" className="border-l-4 border-l-yellow-500">
                <CardHeader
                  title="Pending Scorecards"
                  accent="yellow"
                  action={
                    <span className="text-sm text-yellow-600 font-medium">
                      {data.pendingScorecards.length} awaiting feedback
                    </span>
                  }
                />
                <CardContent noPadding>
                  <div className="divide-y divide-slate-100">
                    {data.pendingScorecards.map((interview) => {
                      const { date } = formatDateTime(interview.scheduledAt);
                      return (
                        <div key={interview.id} className="px-5 py-4 bg-yellow-50/30">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-navy-900">
                                  {interview.candidate.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span>{formatInterviewType(interview.type)}</span>
                                <span className="text-slate-300">•</span>
                                <span>{interview.job.title}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">{date}</span>
                              </div>
                            </div>
                            <Link href={`/applications/${interview.applicationId}` as Route}>
                              <Button variant="primary" size="sm">
                                <StarIcon className="h-4 w-4 mr-1" />
                                Submit Scorecard
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Applications to Review - My Jobs */}
          {data.myJobs.length > 0 && (
            <div className="opacity-0 animate-reveal-5">
              <Card variant="elevated">
                <CardHeader
                  title="Applications to Review"
                  accent="cyan"
                  action={
                    <Link href="/jobs">
                      <Button variant="ghost" size="sm">
                        See all
                      </Button>
                    </Link>
                  }
                />
                <CardContent noPadding>
                  <p className="px-5 pt-4 pb-2 text-sm text-slate-600">
                    Jobs where you&apos;re on the hiring team
                  </p>
                  <div className="divide-y divide-slate-100">
                    {data.myJobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="flex items-center justify-between px-5 py-4 hover:bg-cyan-50/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-navy-900 group-hover:text-cyan-700 transition-colors">
                              {job.title}
                            </span>
                            <Badge variant="neutral" size="sm">{job.role}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" size="sm">
                            Review all ({job.applicationCount})
                          </Button>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Applications */}
          <div className="opacity-0 animate-reveal-6">
            <Card variant="elevated">
              <CardHeader
                title="Recent Applications"
                accent="purple"
                action={
                  <Link href="/applications">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                }
              />
              <CardContent noPadding>
                {data.recentApplications.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <UsersIcon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-600 font-medium">No applications yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Applications will appear here as candidates apply
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.recentApplications.map((app) => (
                      <Link
                        key={app.id}
                        href={`/applications/${app.id}`}
                        className="block px-5 py-4 hover:bg-purple-50/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-navy-900 truncate group-hover:text-purple-700 transition-colors">
                                {app.candidate.name}
                              </h3>
                              <ApplicationStageBadge stage={app.stage} />
                            </div>
                            <p className="text-sm text-slate-600 truncate">
                              {app.job.title}
                              {app.job.location && ` - ${app.job.location}`}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <ClockIcon className="h-3.5 w-3.5" />
                              <span>
                                {new Date(app.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Conversion Funnel */}
          {data.pipeline.length > 0 && (
            <div className="opacity-0 animate-reveal-6">
              <Card variant="elevated">
                <CardHeader title="Conversion Funnel" accent="cyan" />
                <CardContent>
                  <div className="space-y-3">
                    {data.pipeline.map((stage, index) => {
                      const firstStageCount = data.pipeline[0]?.count || 1;
                      const conversionPct = firstStageCount > 0 ? ((stage.count / firstStageCount) * 100).toFixed(0) : '0';
                      return (
                        <div key={stage.stageId || index}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{stage.stageName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-navy-900">{stage.count}</span>
                              {index > 0 && (
                                <span className="text-xs text-slate-500">({conversionPct}%)</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${firstStageCount > 0 ? (stage.count / firstStageCount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6 opacity-0 animate-reveal-4">
          {/* My Tasks */}
          <Card variant="elevated">
            <CardHeader
              title="My Tasks"
              accent="yellow"
              action={
                <Link href={"/applications" as Route}>
                  <Button variant="ghost" size="sm">
                    All Tasks
                  </Button>
                </Link>
              }
            />
            <CardContent>
              {data.taskStats.total === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircleIcon className="h-8 w-8 mx-auto text-success-400 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.taskStats.overdue > 0 && (
                    <Link href={"/applications" as Route} className="flex items-center justify-between p-3 rounded-lg bg-danger-50 hover:bg-danger-100 transition-colors">
                      <span className="text-sm font-medium text-danger-700">Overdue</span>
                      <span className="text-sm font-bold text-danger-600">{data.taskStats.overdue}</span>
                    </Link>
                  )}
                  <Link href={"/applications" as Route} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-navy-900">All Tasks</span>
                    <span className="text-sm font-bold text-purple-600">{data.taskStats.total}</span>
                  </Link>
                </div>
              )}

              {data.myTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Recent Tasks
                  </p>
                  <div className="space-y-2">
                    {data.myTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={task.application ? `/applications/${task.application.id}` : '/applications'}
                        className="block p-2 rounded hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            isPastDue(task.dueAt) ? 'bg-danger-500' :
                            task.priority === 'HIGH' ? 'bg-yellow-500' :
                            task.priority === 'URGENT' ? 'bg-danger-500' :
                            'bg-slate-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-navy-900 truncate">{task.title}</p>
                            {task.application && (
                              <p className="text-xs text-slate-500 truncate">
                                {task.application.candidate.firstName} {task.application.candidate.lastName}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card variant="elevated">
            <CardHeader title="Quick Actions" accent="cyan" />
            <CardContent className="space-y-2">
              <Link href="/jobs/new" className="block">
                <Button variant="outline" size="md" className="w-full justify-start">
                  <PlusIcon className="h-4 w-4" />
                  Post New Job
                </Button>
              </Link>
              <Link href="/candidates" className="block">
                <Button variant="outline" size="md" className="w-full justify-start">
                  <UsersIcon className="h-4 w-4" />
                  Browse Candidates
                </Button>
              </Link>
              <Link href="/applications" className="block">
                <Button variant="outline" size="md" className="w-full justify-start">
                  <DocumentCheckIcon className="h-4 w-4" />
                  Review Applications
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pipeline Status */}
          <Card variant="elevated">
            <CardHeader title="Pipeline Status" accent="purple" />
            <CardContent>
              <div className="space-y-4">
                {data.pipeline.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No pipeline data available
                  </p>
                ) : (
                  data.pipeline.slice(0, 5).map((stage, index) => {
                    const maxCount = Math.max(...data.pipeline.map(s => s.count));
                    const percentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                    const colors = [
                      'from-purple-500 to-purple-600',
                      'from-cyan-500 to-cyan-600',
                      'from-yellow-400 to-yellow-500',
                      'from-green-500 to-green-600',
                      'from-blue-500 to-blue-600',
                    ];
                    return (
                      <div key={stage.stageId || index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-navy-900">
                            {stage.stageName}
                          </span>
                          <span className={`text-sm font-bold ${
                            index === 0 ? 'text-purple-600' :
                            index === 1 ? 'text-cyan-600' :
                            index === 2 ? 'text-yellow-600' :
                            index === 3 ? 'text-success-600' :
                            'text-cyan-600'
                          }`}>
                            {stage.count}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {data.recentActivity && data.recentActivity.length > 0 && (
            <Card variant="elevated">
              <CardHeader title="Recent Activity" accent="purple" />
              <CardContent noPadding>
                <div className="divide-y divide-slate-100">
                  {data.recentActivity.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-navy-900">
                            {activity.applicationId ? (
                              <Link
                                href={`/applications/${activity.applicationId}`}
                                className="hover:text-purple-700 transition-colors"
                              >
                                {activity.title}
                              </Link>
                            ) : (
                              activity.title
                            )}
                          </p>
                          {activity.candidateName && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {activity.candidateName}
                              {activity.jobTitle ? ` \u2014 ${activity.jobTitle}` : ''}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            {activity.user ? `${activity.user} \u00b7 ` : ''}
                            {new Date(activity.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
