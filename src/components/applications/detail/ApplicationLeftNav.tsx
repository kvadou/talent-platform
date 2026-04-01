'use client';

import {
  RectangleStackIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { LeftNavItem } from './ApplicationDetailPage';

type Props = {
  activeItem: LeftNavItem;
  onItemChange: (item: LeftNavItem) => void;
};

const navItems: { id: LeftNavItem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'stages', label: 'Stages', icon: RectangleStackIcon },
  { id: 'scorecards', label: 'Scorecards', icon: ClipboardDocumentCheckIcon },
  { id: 'offer', label: 'Offer details', icon: DocumentTextIcon },
  { id: 'activity', label: 'Activity feed', icon: ClockIcon },
];

export function ApplicationLeftNav({ activeItem, onItemChange }: Props) {
  return (
    <nav className="py-4">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <li key={item.id}>
              <button
                onClick={() => onItemChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-purple/10 text-brand-purple border-l-2 border-brand-purple'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
