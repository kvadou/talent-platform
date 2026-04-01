import { twMerge } from 'tailwind-merge';

export function Skeleton({ className }: { className?: string }) {
  return <div className={twMerge('animate-pulse rounded-lg bg-gray-200', className)} />;
}
