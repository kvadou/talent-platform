'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

async function moveStage(applicationId: string, stageId: string) {
  const res = await fetch(`/api/applications/${applicationId}/move-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageId })
  });
  if (!res.ok) throw new Error('Failed');
}

async function markHire(applicationId: string) {
  const res = await fetch(`/api/applications/${applicationId}/hire`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed');
}

async function markReject(applicationId: string) {
  const res = await fetch(`/api/applications/${applicationId}/reject`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed');
}

export function ActionButtons({ applicationId, stageId }: { applicationId: string; stageId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
      <div className="text-sm font-semibold text-gray-800">Actions</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => handle(() => moveStage(applicationId, stageId))} disabled={loading}>
          Move to next
        </Button>
        <Button size="sm" onClick={() => handle(() => markHire(applicationId))} disabled={loading}>
          Mark hired
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handle(() => markReject(applicationId))} disabled={loading}>
          Reject
        </Button>
      </div>
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}
