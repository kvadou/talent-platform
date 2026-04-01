'use client';

import Link from 'next/link';
import {
  BuildingOfficeIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  EnvelopeIcon,
  BellIcon,
  DocumentTextIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  CreditCardIcon,
  ClockIcon,
  SparklesIcon,
  NewspaperIcon,
  GlobeAltIcon,
  TagIcon,
  BuildingStorefrontIcon,
  HeartIcon,
  CheckBadgeIcon,
  CodeBracketIcon,
  FlagIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  DocumentCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const configItems = [
  {
    name: 'Organization',
    description: 'View or edit your organization\'s details',
    href: '/configure/organization',
    icon: BuildingOfficeIcon,
  },
  {
    name: 'Users',
    description: 'Manage your team members, or invite new users',
    href: '/configure/users',
    icon: UsersIcon,
  },
  {
    name: 'Permission Policies',
    description: 'Manage permission policies for your entire organization',
    href: '/configure/permissions',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Interviewer Groups',
    description: 'Create and manage groups of interviewers',
    href: '/configure/interviewer-groups',
    icon: UserGroupIcon,
  },
  {
    name: 'Email Templates',
    description: 'Configure the email templates sent to candidates',
    href: '/configure/email-templates',
    icon: EnvelopeIcon,
  },
  {
    name: 'Notifications',
    description: 'Configure your notifications',
    href: '/configure/notifications',
    icon: BellIcon,
  },
  {
    name: 'Social Templates',
    description: 'Configure your social media templates',
    href: '/configure/social-templates',
    icon: ShareIcon,
  },
  {
    name: 'Documents',
    description: 'Configure offer templates and e-signature agreements for your entire organization',
    href: '/configure/documents',
    icon: DocumentDuplicateIcon,
  },
  {
    name: 'Billing',
    description: 'View your account team and other plan details',
    href: '/configure/billing',
    icon: CreditCardIcon,
  },
  {
    name: 'Order History',
    description: 'View your order history',
    href: '/configure/order-history',
    icon: ClockIcon,
  },
  {
    name: 'AI Tools',
    description: 'Configure AI tools for your organization',
    href: '/configure/ai-tools',
    icon: SparklesIcon,
  },
  {
    name: 'Job Boards',
    description: 'Manage your Job Board and Job Posts',
    href: '/configure/job-boards',
    icon: NewspaperIcon,
  },
  {
    name: 'Career Site',
    description: 'Manage your organization\'s job seeker settings',
    href: '/configure/career-site',
    icon: GlobeAltIcon,
  },
  {
    name: 'Custom Options',
    description: 'Manage custom tags, sources, rejection reasons, and referrers',
    href: '/configure/custom-options',
    icon: TagIcon,
  },
  {
    name: 'Agencies',
    description: 'Configure agencies and invite an agency to submit candidates directly into your database',
    href: '/configure/agencies',
    icon: BuildingStorefrontIcon,
  },
  {
    name: 'Inclusion Tools',
    description: 'Configure inclusion settings',
    href: '/configure/inclusion',
    icon: HeartIcon,
  },
  {
    name: 'Approvals',
    description: 'Manage default approval workflows',
    href: '/configure/approvals',
    icon: CheckBadgeIcon,
  },
  {
    name: 'Dev Center',
    description: 'Configure your job board, development resources',
    href: '/configure/dev-center',
    icon: CodeBracketIcon,
  },
  {
    name: 'Company Goals',
    description: 'Manage Company Goals for your organization',
    href: '/configure/company-goals',
    icon: FlagIcon,
  },
  {
    name: 'Bulk Import',
    description: 'Import prospects from a spreadsheet',
    href: '/configure/bulk-import',
    icon: ArrowUpTrayIcon,
  },
  {
    name: 'Change Log',
    description: 'View changes made to your organization',
    href: '/configure/change-log',
    icon: ClipboardDocumentListIcon,
  },
  {
    name: 'Candidate Survey',
    description: 'Configure candidate feedback surveys',
    href: '/configure/candidate-survey',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Candidate Packets',
    description: 'Create application packets for candidates',
    href: '/configure/candidate-packets',
    icon: DocumentCheckIcon,
  },
  {
    name: 'Privacy & Compliance',
    description: 'Manage data privacy and compliance settings',
    href: '/configure/privacy',
    icon: LockClosedIcon,
  },
];

export default function ConfigurePage() {
  return (
    <div className="space-y-1">
      {configItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as never}
            className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors group border-b border-gray-100 last:border-0"
          >
            <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-purple-100 transition-colors">
              <Icon className="w-5 h-5 text-gray-600 group-hover:text-brand-purple" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-brand-purple group-hover:underline">
                {item.name}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
