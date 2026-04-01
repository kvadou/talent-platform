'use client';

import { ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type BulkAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

type Props = {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  itemLabel?: string;
};

export function BulkActionBar({ selectedCount, onClear, actions, itemLabel = 'item' }: Props) {
  if (selectedCount === 0) return null;

  const pluralLabel = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-navy-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <span className="bg-purple-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
            {selectedCount}
          </span>
          <span className="text-sm font-medium text-gray-200">
            {pluralLabel} selected
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-600" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {actions.map((action, index) => {
            const baseStyles = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            const variantStyles = {
              primary: 'bg-purple-600 hover:bg-purple-700 text-white',
              secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
              danger: 'bg-danger-600 hover:bg-danger-700 text-white',
            };

            return (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`${baseStyles} ${variantStyles[action.variant || 'secondary']}`}
              >
                {action.icon}
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-600" />

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          title="Clear selection"
        >
          <XMarkIcon className="h-5 w-5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
