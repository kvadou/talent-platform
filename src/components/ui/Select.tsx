import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; helperText?: string };

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, label, helperText, children, ...props }, ref) => (
  <div className="space-y-1.5">
    {label ? (
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
    ) : null}
    <select
      ref={ref}
      className={twMerge(
        'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm',
        'transition-all duration-150',
        'focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none',
        'text-gray-700',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {helperText ? (
      <p className="text-xs text-gray-500">
        {helperText}
      </p>
    ) : null}
  </div>
));
Select.displayName = 'Select';
