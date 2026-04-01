import { Card, CardContent } from '@/components/ui/Card';

export function StatsCards({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
