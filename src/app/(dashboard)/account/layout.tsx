'use client';

import { ReactNode, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import {
  UserIcon,
  ClockIcon,
  LinkIcon,
  CalendarDaysIcon,
  BellIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const navigation: Array<{
  name: string;
  href: Route;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}> = [
  { name: 'Profile', href: '/account', icon: UserIcon, exact: true },
  { name: 'Working Hours', href: '/account/working-hours', icon: ClockIcon },
  { name: 'Scheduling Links', href: '/account/scheduling-links', icon: LinkIcon },
  { name: 'Calendar', href: '/account/calendar', icon: CalendarDaysIcon },
  { name: 'Notifications', href: '/account/notifications', icon: BellIcon },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      {/* Hero Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-purple-200/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Account Settings
          </h1>
          <p className="mt-2 text-purple-200/70 text-lg">
            Manage your profile, availability, and scheduling preferences
          </p>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative -mt-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 p-2 lg:sticky lg:top-24">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-2 px-2 lg:mx-0 lg:px-0 scrollbar-hide">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                      whitespace-nowrap lg:whitespace-normal
                      ${active
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md shadow-purple-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-purple-200' : ''}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
