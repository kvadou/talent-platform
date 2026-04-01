import { format } from 'date-fns';

export function StageHistoryTimeline({ history }: { history: { id: string; stage: { name: string }; movedAt: Date }[] }) {
  return (
    <ol className="space-y-3">
      {history.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <div className="h-2 w-2 rounded-full bg-brand-purple mt-2" />
          <div>
            <div className="text-sm font-medium text-gray-800">Moved to {item.stage.name}</div>
            <div className="text-xs text-gray-500">{format(new Date(item.movedAt), 'PPpp')}</div>
          </div>
        </li>
      ))}
      {history.length === 0 ? <p className="text-sm text-gray-600">No stage changes yet.</p> : null}
    </ol>
  );
}
