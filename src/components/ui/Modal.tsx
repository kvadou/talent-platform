'use client';
import { Dialog } from '@headlessui/react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';
import { XMarkIcon } from '@heroicons/react/24/outline';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      {/* Overlay with backdrop blur */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={twMerge(
          'w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-auto',
          className
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {title}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Body */}
          <div className="px-6 py-6">
            {children}
          </div>
          
          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
