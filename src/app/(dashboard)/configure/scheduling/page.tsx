'use client';

import Link from 'next/link';
import {
  ClockIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const schedulingOptions = [
  {
    name: 'Availability',
    description: 'Set your weekly schedule and working hours for when candidates can book meetings with you.',
    href: '/configure/scheduling/availability',
    icon: ClockIcon,
    color: 'bg-cyan-100 text-cyan-600',
  },
  {
    name: 'Meeting Types',
    description: 'Create and manage different types of meetings like phone screens, video interviews, and more.',
    href: '/configure/scheduling/meeting-types',
    icon: CalendarDaysIcon,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    name: 'Preferences',
    description: 'Configure your timezone, default buffer times, and choose between Calendly or custom scheduling.',
    href: '/configure/scheduling/preferences',
    icon: Cog6ToothIcon,
    color: 'bg-success-100 text-success-600',
  },
];

export default function SchedulingPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scheduling Settings</h1>
        <p className="mt-2 text-gray-600">
          Configure your availability, meeting types, and scheduling preferences to let candidates
          book interviews with you.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {schedulingOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Link
              key={option.name}
              href={option.href as never}
              className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-purple hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${option.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-purple transition-colors">
                    {option.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">{option.description}</p>
                </div>
              </div>
              <ArrowRightIcon className="absolute top-6 right-6 w-5 h-5 text-gray-400 group-hover:text-brand-purple group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Quick Setup Guide */}
      <div className="mt-10 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h2>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-purple text-white flex items-center justify-center text-xs font-medium">
              1
            </span>
            <span>
              <strong>Set your availability</strong> - Define your working hours for each day of the
              week.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-purple text-white flex items-center justify-center text-xs font-medium">
              2
            </span>
            <span>
              <strong>Create meeting types</strong> - Set up different meeting types for phone
              screens, video interviews, etc.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-purple text-white flex items-center justify-center text-xs font-medium">
              3
            </span>
            <span>
              <strong>Configure preferences</strong> - Set your timezone and choose your preferred
              scheduling method.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
