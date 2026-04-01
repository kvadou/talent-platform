import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function ActivityFeed({ items }: { items: { id: string; description: string; time: string }[] }) {
  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="text-sm text-gray-700">
            <div>{item.description}</div>
            <div className="text-xs text-gray-500">{item.time}</div>
          </div>
        ))}
        {items.length === 0 ? <p className="text-sm text-gray-600">No recent activity.</p> : null}
      </CardContent>
    </Card>
  );
}
