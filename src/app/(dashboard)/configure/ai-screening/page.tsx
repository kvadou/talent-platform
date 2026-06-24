'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ScreeningPlayground } from '@/components/playground/ScreeningPlayground';

export default function AIScreeningPlaygroundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">AI Screening Playground</h1>
        <p className="text-sm text-gray-500 mt-1">
          Try Bella, the AI recruiter. Live chat and voice screening, the same
          engine that powers production candidate screens.
        </p>
      </div>

      <Card>
        <CardContent>
          <ScreeningPlayground />
        </CardContent>
      </Card>
    </div>
  );
}
