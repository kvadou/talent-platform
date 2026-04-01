import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { format } from 'date-fns';

export function MessageLogList({ logs }: { logs: any[] }) {
  return (
    <Card>
      <CardHeader title="Messages" />
      <CardContent className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border border-gray-100 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-800">{log.subject ?? log.type}</div>
            <div className="text-xs text-gray-500">{format(new Date(log.sentAt), 'PPpp')} • {log.recipient}</div>
            {log.body ? <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{log.body}</p> : null}
          </div>
        ))}
        {logs.length === 0 ? <p className="text-sm text-gray-600">No messages yet.</p> : null}
      </CardContent>
    </Card>
  );
}
