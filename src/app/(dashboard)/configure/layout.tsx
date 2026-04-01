'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BuildingOfficeIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  EnvelopeIcon,
  BellIcon,
  // DocumentTextIcon,
  // ShareIcon,
  DocumentDuplicateIcon,
  // CreditCardIcon,
  // ClockIcon,
  SparklesIcon,
  NewspaperIcon,
  GlobeAltIcon,
  // TagIcon,
  // BuildingStorefrontIcon,
  // HeartIcon,
  // CheckBadgeIcon,
  // CodeBracketIcon,
  // FlagIcon,
  // ArrowUpTrayIcon,
  // ClipboardDocumentListIcon,
  // ChatBubbleLeftRightIcon,
  // DocumentCheckIcon,
  // LockClosedIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
};

const navigation: NavItem[] = [
  { name: 'Organization', href: '/configure/organization', icon: BuildingOfficeIcon },
  { name: 'Users', href: '/configure/users', icon: UsersIcon },
  { name: 'Permission Policies', href: '/configure/permissions', icon: ShieldCheckIcon },
  { name: 'Interviewer Groups', href: '/configure/interviewer-groups', icon: UserGroupIcon },
  {
    name: 'Scheduling',
    href: '/configure/scheduling',
    icon: CalendarDaysIcon,
    children: [
      { name: 'Availability', href: '/configure/scheduling/availability' },
      { name: 'Meeting Types', href: '/configure/scheduling/meeting-types' },
      { name: 'Preferences', href: '/configure/scheduling/preferences' },
    ],
  },
  { name: 'Email Templates', href: '/configure/email-templates', icon: EnvelopeIcon },
  { name: 'Notifications', href: '/configure/notifications', icon: BellIcon },
  // { name: 'Email Settings', href: '/configure/email-settings', icon: DocumentTextIcon,
  //   children: [
  //     { name: 'Domain Settings', href: '/configure/email-settings/domain' },
  //     { name: 'Sender Profiles', href: '/configure/email-settings/senders' },
  //   ],
  // },
  // { name: 'Social Templates', href: '/configure/social-templates', icon: ShareIcon },
  {
    name: 'Documents',
    href: '/configure/documents',
    icon: DocumentDuplicateIcon,
    children: [
      { name: 'Offer Templates', href: '/configure/documents/offers' },
      { name: 'E-Signatures', href: '/configure/documents/esignatures' },
    ],
  },
  // { name: 'Billing', href: '/configure/billing', icon: CreditCardIcon },
  // { name: 'Order History', href: '/configure/order-history', icon: ClockIcon },
  { name: 'AI Tools', href: '/configure/ai-tools', icon: SparklesIcon },
  { name: 'Job Boards', href: '/configure/job-boards', icon: NewspaperIcon },
  { name: 'Career Site', href: '/configure/career-site', icon: GlobeAltIcon },
  // { name: 'Custom Options', href: '/configure/custom-options', icon: TagIcon },
  // { name: 'Agencies', href: '/configure/agencies', icon: BuildingStorefrontIcon },
  // { name: 'Inclusion Tools', href: '/configure/inclusion', icon: HeartIcon },
  // { name: 'Approvals', href: '/configure/approvals', icon: CheckBadgeIcon },
  // {
  //   name: 'Dev Center',
  //   href: '/configure/dev-center',
  //   icon: CodeBracketIcon,
  //   children: [
  //     { name: 'API Keys', href: '/configure/dev-center/api-keys' },
  //     { name: 'Webhooks', href: '/configure/dev-center/webhooks' },
  //   ],
  // },
  // { name: 'Company Goals', href: '/configure/company-goals', icon: FlagIcon },
  // { name: 'Bulk Import', href: '/configure/bulk-import', icon: ArrowUpTrayIcon },
  // { name: 'Change Log', href: '/configure/change-log', icon: ClipboardDocumentListIcon },
  // { name: 'Candidate Survey', href: '/configure/candidate-survey', icon: ChatBubbleLeftRightIcon },
  // { name: 'Candidate Packets', href: '/configure/candidate-packets', icon: DocumentCheckIcon },
  // { name: 'Privacy & Compliance', href: '/configure/privacy', icon: LockClosedIcon },
];

export default function ConfigureLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMainPage = pathname === '/configure';

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex flex-col md:flex-row md:gap-8">
      {/* Sidebar - hidden on mobile, visible on md+ */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="sticky top-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Configure</h2>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <div key={item.name}>
                  <Link
                    href={item.href as never}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-purple-50 text-brand-purple'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </div>
                    {item.children && (
                      <ChevronRightIcon className={`w-4 h-4 transition-transform ${active ? 'rotate-90' : ''}`} />
                    )}
                  </Link>

                  {/* Children */}
                  {item.children && active && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href as never}
                          className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            pathname === child.href
                              ? 'bg-purple-100 text-brand-purple font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header for subpages */}
        {!isMainPage && (
          <div className="md:hidden mb-4">
            <Link
              href="/configure"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-brand-purple transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Configure
            </Link>
          </div>
        )}
        {/* Mobile title for main page */}
        {isMainPage && (
          <h2 className="md:hidden text-2xl font-bold text-gray-900 mb-6">Configure</h2>
        )}
        {children}
      </main>
    </div>
  );
}
