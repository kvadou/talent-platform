import { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'cyan' | 'yellow';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
};

const base =
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-250 ease-out-expo focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none rounded-lg relative overflow-hidden';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md hover:shadow-xl hover:from-purple-700 hover:to-purple-800 focus:ring-purple-500 active:scale-[0.98]',
  secondary:
    'bg-white text-purple-700 border-2 border-purple-200 shadow-sm hover:bg-purple-50 hover:border-purple-300 hover:shadow-md focus:ring-purple-500 active:scale-[0.98]',
  outline:
    'bg-transparent text-navy-700 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-500 active:scale-[0.98]',
  ghost:
    'bg-transparent text-navy-700 hover:bg-slate-100 focus:ring-slate-400 active:scale-[0.98]',
  danger:
    'bg-gradient-to-br from-danger-500 to-danger-600 text-white shadow-md hover:shadow-xl hover:from-danger-600 hover:to-danger-700 focus:ring-danger-500 active:scale-[0.98]',
  success:
    'bg-gradient-to-br from-success-500 to-success-600 text-white shadow-md hover:shadow-xl hover:from-success-600 hover:to-success-700 focus:ring-success-500 active:scale-[0.98]',
  cyan:
    'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md hover:shadow-xl hover:from-cyan-600 hover:to-cyan-700 focus:ring-cyan-500 active:scale-[0.98]',
  yellow:
    'bg-gradient-to-br from-yellow-400 to-yellow-500 text-navy-900 shadow-md hover:shadow-xl hover:from-yellow-500 hover:to-yellow-600 focus:ring-yellow-500 active:scale-[0.98]',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={twMerge(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Left icon */}
        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {/* Button text */}
        {children && <span className="truncate inline-flex items-center">{children}</span>}

        {/* Right icon */}
        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {/* Shine effect on hover (for gradient buttons) */}
        {['primary', 'danger', 'success', 'cyan', 'yellow'].includes(variant) && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Icon Button variant - square button with just an icon
interface IconButtonProps extends Omit<ButtonProps, 'icon' | 'iconPosition'> {
  children: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const iconSizes: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'w-6 h-6 p-1',
      sm: 'w-7 h-7 p-1.5',
      md: 'w-8 h-8 p-1.5',
      lg: 'w-10 h-10 p-2',
      xl: 'w-12 h-12 p-2.5',
    };

    return (
      <Button
        ref={ref}
        size={size}
        className={twMerge('!px-0', iconSizes[size], className)}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';
