import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Link from 'next/link';
import {
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  DocumentTextIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

type Props = {
  params: Promise<{ id: string }>;
};

async function getJobDashboardData(jobId: string) {
  const [job, applicationStats, stageStats, recentActivity] = await Promise.all([
    // Get job with related data
    prisma.job.findUnique({
      where: { id: jobId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        _count: { select: { applications: true } },
      },
    }),

    // Get application stats
    prisma.application.groupBy({
      by: ['status'],
      where: { jobId },
      _count: true,
    }),

    // Get stage counts
    prisma.application.groupBy({
      by: ['stageId'],
      where: { jobId, status: 'ACTIVE' },
      _count: true,
    }),

    // Get recent activity
    prisma.activityLog.findMany({
      where: {
        application: { jobId },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        application: {
          select: {
            candidate: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Calculate stats
  const totalApplications = job?._count.applications || 0;
  const activeApplications = applicationStats.find((s) => s.status === 'ACTIVE')?._count || 0;
  const hiredCount = applicationStats.find((s) => s.status === 'HIRED')?._count || 0;
  const rejectedCount = applicationStats.find((s) => s.status === 'REJECTED')?._count || 0;

  // Map stage counts
  const stageCountsMap = new Map(stageStats.map((s) => [s.stageId, s._count]));

  // Get new applications in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newApplications = await prisma.application.count({
    where: {
      jobId,
      createdAt: { gte: sevenDaysAgo },
    },
  });

  return {
    job,
    stats: {
      total: totalApplications,
      active: activeApplications,
      hired: hiredCount,
      rejected: rejectedCount,
      new: newApplications,
    },
    stageCountsMap,
    recentActivity,
  };
}

export default async function JobDashboardPage({ params }: Props) {
  const { id } = await params;
  const { job, stats, stageCountsMap, recentActivity } = await getJobDashboardData(id);

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Candidates"
          value={stats.total}
          icon={UsersIcon}
          color="purple"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={ClockIcon}
          color="blue"
        />
        <StatCard
          label="Hired"
          value={stats.hired}
          icon={CheckCircleIcon}
          color="green"
        />
        <StatCard
          label="New This Week"
          value={stats.new}
          icon={ArrowTrendingUpIcon}
          color="cyan"
          trend={stats.new > 0 ? `+${stats.new}` : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pipeline Summary */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pipeline Summary"
            action={
              <Link
                href={`/jobs/${job.id}/pipeline` as never}
                className="text-sm text-brand-purple hover:underline"
              >
                View Pipeline →
              </Link>
            }
          />
          <CardContent>
            <div className="space-y-3">
              {job.stages.map((stage) => {
                const count = stageCountsMap.get(stage.id) || 0;
                const percentage = stats.active > 0 ? (count / stats.active) * 100 : 0;

                return (
                  <div key={stage.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-brand-purple transition-colors">
                        {stage.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-purple rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {job.stages.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No stages configured. <Link href={`/jobs/${job.id}/setup/interview-plan` as never} className="text-brand-purple hover:underline">Add stages</Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Tasks */}
        <Card>
          <CardHeader title="Pipeline Tasks" />
          <CardContent>
            <div className="space-y-3">
              <TaskRow
                icon={DocumentTextIcon}
                label="New Applications"
                count={stats.new}
                href={`/jobs/${job.id}/candidates?filter=new`}
              />
              <TaskRow
                icon={CalendarIcon}
                label="Interviews to Schedule"
                count={0}
                href={`/jobs/${job.id}/candidates?filter=to-schedule`}
              />
              <TaskRow
                icon={ListBulletIcon}
                label="Scorecards Due"
                count={0}
                href={`/jobs/${job.id}/candidates?filter=scorecards`}
              />
              <TaskRow
                icon={ExclamationTriangleIcon}
                label="Candidates Stuck"
                count={0}
                href={`/jobs/${job.id}/candidates?filter=stuck`}
                warning
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader
          title="Recent Activity"
          action={
            <Link
              href={`/jobs/${job.id}/setup/activity` as never}
              className="text-sm text-brand-purple hover:underline"
            >
              View All →
            </Link>
          }
        />
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const candidateName = activity.application?.candidate
                  ? `${activity.application.candidate.firstName} ${activity.application.candidate.lastName}`
                  : 'Unknown';
                const userName = activity.user
                  ? `${activity.user.firstName} ${activity.user.lastName}`
                  : 'System';

                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-brand-purple flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(activity.createdAt)}
                        {activity.user && ` • ${userName}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'purple' | 'blue' | 'green' | 'cyan';
  trend?: string;
}) {
  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-cyan-50 text-cyan-600',
    green: 'bg-success-50 text-success-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <span className="text-xs font-medium text-success-600 bg-success-50 px-2 py-0.5 rounded">
              {trend}
            </span>
          )}
        </div>
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  icon: Icon,
  label,
  count,
  href,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  warning?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${warning ? 'text-warning-500' : 'text-gray-400'}`} />
        <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
      </div>
      <span
        className={`text-sm font-semibold ${
          count > 0
            ? warning
              ? 'text-warning-600'
              : 'text-brand-purple'
            : 'text-gray-400'
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
}
