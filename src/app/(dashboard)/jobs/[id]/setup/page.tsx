import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  InformationCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ListBulletIcon,
  ClockIcon,
  BoltIcon,
  UserGroupIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

type Props = {
  params: Promise<{ id: string }>;
};

async function getJobSetupData(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      department: true,
      office: true,
      stages: true,
      stageRules: true,
      hiringTeam: true,
      notificationConfigs: true,
      posts: true,
      forms: true,
      matchingKeywords: true,
      interviewKits: {
        include: {
          categories: {
            include: {
              attributes: true,
            },
          },
        },
      },
      _count: {
        select: {
          openings: true,
        },
      },
    },
  });

  return job;
}

export default async function JobSetupPage({ params }: Props) {
  const { id } = await params;
  const job = await getJobSetupData(id);

  if (!job) {
    return <div>Job not found</div>;
  }

  const setupSections = [
    {
      title: 'Job Info',
      description: 'Basic job details, department, office, and openings',
      href: `/jobs/${job.id}/setup/info`,
      icon: InformationCircleIcon,
      status: job.title && job.department ? 'complete' : 'incomplete',
      details: [
        job.title ? `Title: ${job.title}` : 'No title set',
        job.department ? `Department: ${job.department.name}` : 'No department',
        `${job._count.openings || 0} opening(s)`,
      ],
    },
    {
      title: 'Job Posts',
      description: 'Manage job board postings and career page',
      href: `/jobs/${job.id}/setup/posts`,
      icon: DocumentTextIcon,
      status: job.status === 'PUBLISHED' || job.posts.length > 0 ? 'complete' : 'not_started',
      details: [
        job.status === 'PUBLISHED' ? 'Live on careers page' : 'Not on careers page',
        ...(job.posts.length > 0
          ? [`${job.posts.length} board post(s)`, job.posts.filter((p) => p.status === 'LIVE').length + ' live']
          : []),
      ],
    },
    {
      title: 'Application Questions',
      description: 'Screening questions for applicants',
      href: `/jobs/${job.id}/setup/forms`,
      icon: ClipboardDocumentListIcon,
      status: job.forms.length > 0 ? 'complete' : 'not_started',
      details: [`${job.forms.length} form(s) configured`],
    },
    {
      title: 'Scorecard',
      description: 'Candidate evaluation criteria',
      href: `/jobs/${job.id}/setup/scorecard`,
      icon: ListBulletIcon,
      status: job.scorecardTemplateId ? 'complete' : 'not_started',
      details: [
        job.scorecardTemplateId ? 'Template assigned' : 'No template',
        job.scorecardOverrides ? 'With customizations' : '',
      ].filter(Boolean),
    },
    {
      title: 'Interview Plan',
      description: 'Pipeline stages and workflow',
      href: `/jobs/${job.id}/setup/interview-plan`,
      icon: ClockIcon,
      status: job.stages.length > 1 ? 'complete' : 'incomplete',
      details: [`${job.stages.length} stage(s)`],
    },
    {
      title: 'Interview Kits',
      description: 'Prep guides, scorecards, and AI transcription settings',
      href: `/jobs/${job.id}/setup/interview-kits`,
      icon: BookOpenIcon,
      status: job.interviewKits.length > 0 ? 'complete' : 'not_started',
      details: [
        `${job.interviewKits.length} kit(s) configured`,
        job.interviewKits.reduce((sum, kit) => sum + kit.categories.reduce((catSum, cat) => catSum + cat.attributes.length, 0), 0) + ' attributes',
      ].filter(Boolean),
    },
    {
      title: 'Stage Transitions',
      description: 'Automation rules when candidates move stages',
      href: `/jobs/${job.id}/setup/transitions`,
      icon: BoltIcon,
      status: job.stageRules.length > 0 ? 'complete' : 'not_started',
      details: [`${job.stageRules.length} rule(s) configured`],
    },
    {
      title: 'Hiring Team',
      description: 'Team members and their permissions',
      href: `/jobs/${job.id}/setup/team`,
      icon: UserGroupIcon,
      status: job.hiringTeam.length > 0 ? 'complete' : 'not_started',
      details: [`${job.hiringTeam.length} team member(s)`],
    },
    {
      title: 'Notifications',
      description: 'Email notification preferences',
      href: `/jobs/${job.id}/setup/notifications`,
      icon: BellIcon,
      status: job.notificationConfigs.length > 0 ? 'complete' : 'not_started',
      details: [
        `${job.notificationConfigs.filter((n) => n.isEnabled).length} notification(s) enabled`,
      ],
    },
    {
      title: 'Candidate Matching',
      description: 'AI-powered keywords for automatic candidate ranking',
      href: `/jobs/${job.id}/setup/matching`,
      icon: SparklesIcon,
      status: job.matchingKeywords.length > 0 ? 'complete' : 'not_started',
      details: [
        `${job.matchingKeywords.length} keyword(s) configured`,
        job.matchingKeywords.length > 0
          ? `Total expansions: ${job.matchingKeywords.reduce((sum, k) => sum + k.expansions.length, 0)}`
          : '',
      ].filter(Boolean),
    },
  ];

  const completedCount = setupSections.filter((s) => s.status === 'complete').length;
  const progress = Math.round((completedCount / setupSections.length) * 100);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Job Setup Progress</h2>
            <p className="text-sm text-gray-500 mt-1">
              Complete these sections to fully configure your job posting
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-purple">{progress}%</p>
            <p className="text-xs text-gray-500">
              {completedCount} of {setupSections.length} complete
            </p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-purple rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Setup Cards Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {setupSections.map((section) => {
          const Icon = section.icon;
          const isComplete = section.status === 'complete';
          const isIncomplete = section.status === 'incomplete';

          return (
            <Link
              key={section.title}
              href={section.href as never}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-purple hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    isComplete
                      ? 'bg-success-50 text-success-600'
                      : isIncomplete
                      ? 'bg-warning-50 text-warning-600'
                      : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-purple transition-colors">
                      {section.title}
                    </h3>
                    {isComplete && (
                      <CheckCircleIcon className="w-5 h-5 text-success-500" />
                    )}
                    {isIncomplete && (
                      <ExclamationCircleIcon className="w-5 h-5 text-warning-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{section.description}</p>

                  {section.details.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {section.details.map((detail, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <svg
                  className="w-5 h-5 text-gray-300 group-hover:text-brand-purple transition-colors flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
