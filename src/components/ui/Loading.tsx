export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-purple border-t-transparent" />
      {label ?? 'Loading...'}
    </div>
  );
}
