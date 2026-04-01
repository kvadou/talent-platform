'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import {
  ChartBarSquareIcon,
  UsersIcon,
  ViewColumnsIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ListBulletIcon,
  BoltIcon,
  UserGroupIcon,
  BellIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
};

type Props = {
  jobId: string;
};

export function JobDetailSidebar({ jobId }: Props) {
  const pathname = usePathname();
  const basePath = `/jobs/${jobId}`;

  const mainNavItems: NavItem[] = [
    { href: basePath, label: 'Dashboard', icon: ChartBarSquareIcon },
    { href: `${basePath}/candidates`, label: 'Candidates', icon: UsersIcon },
    { href: `${basePath}/pipeline`, label: 'Pipeline', icon: ViewColumnsIcon },
    { href: `${basePath}/matching`, label: 'Matching', icon: SparklesIcon },
  ];

  const setupNavItems: NavItem[] = [
    { href: `${basePath}/setup`, label: 'Job Setup', icon: Cog6ToothIcon },
    { href: `${basePath}/setup/info`, label: 'Job Info', icon: InformationCircleIcon },
    { href: `${basePath}/setup/posts`, label: 'Job Posts', icon: DocumentTextIcon },
    { href: `${basePath}/setup/forms`, label: 'Application Questions', icon: ClipboardDocumentListIcon },
    { href: `${basePath}/setup/scorecard`, label: 'Scorecard', icon: ListBulletIcon },
    { href: `${basePath}/setup/interview-plan`, label: 'Interview Plan', icon: ClockIcon },
    { href: `${basePath}/setup/transitions`, label: 'Stage Transitions', icon: BoltIcon },
    { href: `${basePath}/setup/team`, label: 'Hiring Team', icon: UserGroupIcon },
    { href: `${basePath}/setup/notifications`, label: 'Notifications', icon: BellIcon },
  ];

  const isActive = (href: string) => {
    // Exact match for dashboard and job setup overview
    if (href === basePath || href === `${basePath}/setup`) {
      return pathname === href;
    }
    // Prefix match for other routes
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        href={item.href as never}
        className={twMerge(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5',
          'text-sm font-medium transition-all duration-200',
          active
            ? 'bg-brand-purple text-white shadow-sm'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon
          className={twMerge(
            'h-5 w-5 flex-shrink-0 transition-all',
            active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
      <nav className="p-4 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Setup Section */}
        <div>
          <h3 className="px-3 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
            Setup
          </h3>
          <div className="space-y-1">
            {setupNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
