import { Button } from './Button';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-gray-200 p-10">
      <div className="text-2xl font-semibold text-gray-900 mb-2">{title}</div>
      <p className="text-sm text-gray-600 mb-4 max-w-md">{description}</p>
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
