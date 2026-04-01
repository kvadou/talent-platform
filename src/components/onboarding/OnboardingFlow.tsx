import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function OnboardingFlow() {
  return (
    <Card>
      <CardHeader title="Getting Started" />
      <CardContent className="space-y-2 text-sm text-gray-700">
        <p>1) Create your first job</p>
        <p>2) Share the public application link</p>
        <p>3) Track candidates in the pipeline</p>
        <Button size="sm">Start onboarding</Button>
      </CardContent>
    </Card>
  );
}
