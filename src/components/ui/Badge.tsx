import { twMerge } from 'tailwind-merge';

type BadgeProps = {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'error' | 'neutral' | 'purple' | 'cyan' | 'yellow' | 'custom';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
};

const variantMap = {
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-800 border-warning-200',
  info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  error: 'bg-danger-50 text-danger-700 border-danger-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  custom: '', // Allow full customization via className
};

const dotColors = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  info: 'bg-cyan-500',
  error: 'bg-danger-500',
  neutral: 'bg-slate-500',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
  yellow: 'bg-yellow-500',
  custom: 'bg-slate-500',
};

const sizeMap = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
  size = 'md',
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full font-semibold border',
        'transition-all duration-200',
        sizeMap[size],
        variantMap[variant],
        className
      )}
    >
      {dot && (
        <span
          className={twMerge(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}

// Specialized badge variants for common use cases

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'draft' | 'published' | 'archived';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    active: { variant: 'success' as const, label: 'Active', dot: true },
    inactive: { variant: 'neutral' as const, label: 'Inactive', dot: true },
    pending: { variant: 'warning' as const, label: 'Pending', dot: true },
    draft: { variant: 'neutral' as const, label: 'Draft', dot: false },
    published: { variant: 'success' as const, label: 'Published', dot: false },
    archived: { variant: 'neutral' as const, label: 'Archived', dot: false },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
}

interface ApplicationStageBadgeProps {
  stage: string;
  className?: string;
}

export function ApplicationStageBadge({ stage, className }: ApplicationStageBadgeProps) {
  // Map common stage names to variants
  const stageVariants: Record<string, BadgeProps['variant']> = {
    'new': 'purple',
    'screening': 'cyan',
    'phone screen': 'cyan',
    'interview': 'yellow',
    'technical': 'yellow',
    'offer': 'success',
    'hired': 'success',
    'rejected': 'error',
    'withdrawn': 'neutral',
  };

  const lowerStage = stage.toLowerCase();
  const variant = stageVariants[lowerStage] || 'neutral';

  return (
    <Badge variant={variant} dot className={className}>
      {stage}
    </Badge>
  );
}

// Pill variant - larger, more prominent badge
interface PillBadgeProps extends Omit<BadgeProps, 'size'> {
  icon?: React.ReactNode;
}

export function PillBadge({ icon, children, className, ...props }: PillBadgeProps) {
  return (
    <Badge
      size="lg"
      className={twMerge('font-bold tracking-wide', className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </Badge>
  );
}

// Count badge - for displaying numbers
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeProps['variant'];
  className?: string;
}

export function CountBadge({ count, max = 99, variant = 'purple', className }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Badge
      variant={variant}
      size="sm"
      className={twMerge(
        'min-w-[1.25rem] h-5 px-1.5 justify-center font-bold',
        className
      )}
    >
      {displayCount}
    </Badge>
  );
}
