'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import {
  BriefcaseIcon,
  HomeIcon,
  UsersIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  BoltIcon,
  ChartBarIcon,
  QueueListIcon,
  CalendarDaysIcon,
  SparklesIcon,
  LightBulbIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

const mainLinks = [
  { href: '/dashboard' as const, label: 'Dashboard', icon: HomeIcon, accent: 'purple' },
  { href: '/franchise' as const, label: 'My Hiring', icon: BuildingStorefrontIcon, accent: 'yellow' },
  { href: '/jobs' as const, label: 'Jobs', icon: BriefcaseIcon, accent: 'cyan' },
  { href: '/candidates' as const, label: 'Candidates', icon: UsersIcon, accent: 'yellow' },
  { href: '/applications' as const, label: 'Applications', icon: QueueListIcon, accent: 'purple' },
  { href: '/interviews' as const, label: 'Interviews', icon: CalendarDaysIcon, accent: 'cyan' },
] as const;

const analyticsLinks = [
  { href: '/analytics/ai-accuracy' as const, label: 'AI Accuracy', icon: SparklesIcon, accent: 'purple' },
  { href: '/analytics/patterns' as const, label: 'Pattern Library', icon: LightBulbIcon, accent: 'yellow' },
  { href: '/analytics/talk-time' as const, label: 'Talk Time', icon: ChartBarIcon, accent: 'cyan' },
] as const;

const adminLinks = [
  { href: '/admin/screening' as const, label: 'AI Screening', icon: SparklesIcon, accent: 'purple' },
  { href: '/admin/scheduling' as const, label: 'Scheduling', icon: CalendarDaysIcon, accent: 'cyan' },
  { href: '/admin/tasks' as const, label: 'Tasks', icon: CheckCircleIcon, accent: 'yellow' },
  { href: '/admin/email-templates' as const, label: 'Email Templates', icon: EnvelopeIcon, accent: 'purple' },
  { href: '/admin/sequences' as const, label: 'Sequences', icon: QueueListIcon, accent: 'cyan' },
  { href: '/admin/stage-rules' as const, label: 'Stage Rules', icon: BoltIcon, accent: 'yellow' },
  { href: '/admin/reporting' as const, label: 'Reporting', icon: ChartBarIcon, accent: 'purple' },
  { href: '/admin/migrations' as const, label: 'Migrations', icon: Cog6ToothIcon, accent: 'cyan' }
] as const;

const accentColors = {
  purple: {
    active: 'bg-[#F0EAFA] text-[#6A469D] font-medium border-l-[3px] border-[#6A469D] pl-[9px]',
    hover: 'hover:bg-neutral-50 hover:text-neutral-900',
    icon: 'text-[#6A469D]'
  },
  cyan: {
    active: 'bg-[#F0EAFA] text-[#6A469D] font-medium border-l-[3px] border-[#6A469D] pl-[9px]',
    hover: 'hover:bg-neutral-50 hover:text-neutral-900',
    icon: 'text-[#6A469D]'
  },
  yellow: {
    active: 'bg-[#F0EAFA] text-[#6A469D] font-medium border-l-[3px] border-[#6A469D] pl-[9px]',
    hover: 'hover:bg-neutral-50 hover:text-neutral-900',
    icon: 'text-[#6A469D]'
  }
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden fixed left-0 top-20 sm:top-24 bottom-0 w-72 bg-gradient-to-b from-white to-slate-50/50 border-r border-slate-200/60 lg:block z-20 overflow-y-auto shadow-lg">
      {/* Background pattern - lowest layer */}
      <div className="absolute inset-0 bg-grain opacity-30 pointer-events-none -z-10" />

      {/* Decorative top gradient */}
      <div className="h-px bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-yellow-500/20 relative z-10" />

      {/* Navigation */}
      <nav className="px-4 py-6 space-y-1.5 relative z-10">
        <div className="mb-4">
          <h2 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
            Navigation
          </h2>
        </div>

        {mainLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          const colors = accentColors[link.accent];

          return (
            <Link
              key={link.href}
              href={link.href}
              className={twMerge(
                'group flex items-center gap-3 h-11 rounded-[10px] px-3',
                'text-sm font-medium transition-all duration-200',
                '',
                active
                  ? colors.active
                  : `text-neutral-600 ${colors.hover}`
              )}
            >
              <Icon
                className={twMerge(
                  'h-5 w-5 flex-shrink-0 transition-all duration-250',
                  active ? 'text-[#6A469D]' : 'text-neutral-500 group-hover:text-neutral-900'
                )}
              />
              <span className="truncate">
                {link.label}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          );
        })}

        {/* Analytics Section */}
        <div className="mt-6 mb-4 pt-4 border-t border-slate-200/60">
          <h2 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
            AI & Analytics
          </h2>
        </div>

        {analyticsLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          const colors = accentColors[link.accent];

          return (
            <Link
              key={link.href}
              href={link.href}
              className={twMerge(
                'group flex items-center gap-3 h-11 rounded-[10px] px-3',
                'text-sm font-medium transition-all duration-200',
                '',
                active
                  ? colors.active
                  : `text-neutral-600 ${colors.hover}`
              )}
            >
              <Icon
                className={twMerge(
                  'h-5 w-5 flex-shrink-0 transition-all duration-250',
                  active ? 'text-[#6A469D]' : 'text-neutral-500 group-hover:text-neutral-900'
                )}
              />
              <span className="truncate">
                {link.label}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          );
        })}

        {/* Admin Section */}
        <div className="mt-6 mb-4 pt-4 border-t border-slate-200/60">
          <h2 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
            Admin
          </h2>
        </div>

        {adminLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          const colors = accentColors[link.accent];

          return (
            <Link
              key={link.href}
              href={link.href}
              className={twMerge(
                'group flex items-center gap-3 h-11 rounded-[10px] px-3',
                'text-sm font-medium transition-all duration-200',
                '',
                active
                  ? colors.active
                  : `text-neutral-600 ${colors.hover}`
              )}
            >
              <Icon
                className={twMerge(
                  'h-5 w-5 flex-shrink-0 transition-all duration-250',
                  active ? 'text-[#6A469D]' : 'text-neutral-500 group-hover:text-neutral-900'
                )}
              />
              <span className="truncate">
                {link.label}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
