import { twMerge } from 'tailwind-merge';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  hover?: boolean;
}

export function Card({
  className,
  children,
  variant = 'default',
  hover = true
}: CardProps) {
  const variants = {
    default: 'bg-white border border-slate-200/60 shadow-sm',
    elevated: 'bg-white border border-slate-200/40 shadow-md',
    bordered: 'bg-white border-2 border-slate-200/80',
    ghost: 'bg-slate-50/50 border border-slate-100',
  };

  const hoverStyles = hover
    ? 'hover:shadow-lg hover:border-purple-200/40 hover:-translate-y-0.5'
    : '';

  return (
    <div className={twMerge(
      'rounded-lg overflow-hidden',
      'transition-all duration-300 ease-out-expo',
      'bg-gradient-to-br from-white via-white to-slate-50/30',
      variants[variant],
      hoverStyles,
      className
    )}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  accent?: 'purple' | 'cyan' | 'yellow' | 'none';
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  accent = 'none'
}: CardHeaderProps) {
  const accentStyles = {
    purple: 'border-l-4 border-l-purple-500 pl-5',
    cyan: 'border-l-4 border-l-cyan-500 pl-5',
    yellow: 'border-l-4 border-l-yellow-500 pl-5',
    none: '',
  };

  return (
    <div className={twMerge(
      'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
      'px-4 sm:px-5 py-3 sm:py-3.5',
      'border-b border-slate-100',
      'bg-gradient-to-r from-slate-50/50 to-transparent',
      accentStyles[accent],
      className
    )}>
      <div className="flex-1 min-w-0">
        {typeof title === 'string' ? (
          <h3 className="text-sm sm:text-base font-display font-semibold text-navy-900 tracking-tight">
            {title}
          </h3>
        ) : title}
        {subtitle && (
          <p className="mt-1 text-sm text-slate-600 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 w-full sm:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardContent({
  children,
  className,
  noPadding = false
}: CardContentProps) {
  return (
    <div className={twMerge(
      !noPadding && 'px-4 sm:px-5 py-4 sm:py-5',
      className
    )}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={twMerge(
      'px-4 sm:px-5 py-3',
      'border-t border-slate-100',
      'bg-gradient-to-r from-transparent to-slate-50/30',
      className
    )}>
      {children}
    </div>
  );
}

// Stat Card variant - for dashboard metrics
interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, change, icon, className, highlight }: StatCardProps) {
  const trendColors = {
    up: 'text-success-600 bg-success-50',
    down: 'text-danger-600 bg-danger-50',
    neutral: 'text-slate-600 bg-slate-50',
  };

  return (
    <Card
      className={twMerge(
        'relative overflow-hidden',
        highlight && 'ring-2 ring-purple-500 ring-offset-2',
        className
      )}
      variant="elevated"
    >
      <CardContent className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-display font-semibold text-navy-900 tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {change && (
              <div className={twMerge(
                'inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold',
                trendColors[change.trend]
              )}>
                {change.trend === 'up' && '↑'}
                {change.trend === 'down' && '↓'}
                {change.trend === 'neutral' && '→'}
                <span>{change.value}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-50 to-cyan-50 text-purple-500">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
    </Card>
  );
}
