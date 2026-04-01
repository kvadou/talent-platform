import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function QuickActions() {
  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <CardContent className="flex gap-3">
        <Link href="/jobs/new">
          <Button size="sm">Create Job</Button>
        </Link>
        <Link href="/jobs">
          <Button size="sm" variant="secondary">
            View Pipeline
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
