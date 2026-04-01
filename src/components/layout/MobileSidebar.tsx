'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
  LightBulbIcon
} from '@heroicons/react/24/outline';

const mainLinks = [
  { href: '/dashboard' as const, label: 'Dashboard', icon: HomeIcon },
  { href: '/jobs' as const, label: 'Jobs', icon: BriefcaseIcon },
  { href: '/candidates' as const, label: 'Candidates', icon: UsersIcon },
  { href: '/applications' as const, label: 'Applications', icon: QueueListIcon },
  { href: '/interviews' as const, label: 'Interviews', icon: CalendarDaysIcon },
] as const;

const analyticsLinks = [
  { href: '/analytics/ai-accuracy' as const, label: 'AI Accuracy', icon: SparklesIcon },
  { href: '/analytics/patterns' as const, label: 'Pattern Library', icon: LightBulbIcon },
  { href: '/analytics/talk-time' as const, label: 'Talk Time', icon: ChartBarIcon },
] as const;

const adminLinks = [
  { href: '/admin/screening' as const, label: 'AI Screening', icon: SparklesIcon },
  { href: '/admin/scheduling' as const, label: 'Scheduling', icon: CalendarDaysIcon },
  { href: '/admin/tasks' as const, label: 'Tasks', icon: CheckCircleIcon },
  { href: '/admin/email-templates' as const, label: 'Email Templates', icon: EnvelopeIcon },
  { href: '/admin/sequences' as const, label: 'Sequences', icon: QueueListIcon },
  { href: '/admin/stage-rules' as const, label: 'Stage Rules', icon: BoltIcon },
  { href: '/admin/reporting' as const, label: 'Reporting', icon: ChartBarIcon },
  { href: '/admin/migrations' as const, label: 'Migrations', icon: Cog6ToothIcon }
] as const;

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay */}
      <div
        className={twMerge(
          'fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        style={{ touchAction: 'manipulation' }}
      />

      {/* Sidebar Drawer */}
      <aside
        className={twMerge(
          'fixed top-[92px] sm:top-[128px] left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 lg:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {mainLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={twMerge(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200',
                  active && 'bg-brand-purple text-white shadow-sm'
                )}
              >
                <Icon className={twMerge('h-5 w-5', active ? 'text-white' : 'text-brand-purple')} />
                {link.label}
              </Link>
            );
          })}

          {/* AI & Analytics Section */}
          <div className="pt-4 mt-4 border-t border-gray-200">
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI & Analytics
            </h3>
            {analyticsLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={twMerge(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200',
                    active && 'bg-brand-purple text-white shadow-sm'
                  )}
                >
                  <Icon className={twMerge('h-5 w-5', active ? 'text-white' : 'text-brand-purple')} />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Admin Section */}
          <div className="pt-4 mt-4 border-t border-gray-200">
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </h3>
            {adminLinks.map((link) => {
              const active = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={twMerge(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200',
                    active && 'bg-brand-purple text-white shadow-sm'
                  )}
                >
                  <Icon className={twMerge('h-5 w-5', active ? 'text-white' : 'text-brand-purple')} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}

