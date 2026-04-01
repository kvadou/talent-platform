'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function NoteForm({ applicationId, onCreated }: { applicationId: string; onCreated?: () => void }) {
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isPrivate })
      });
      if (!res.ok) throw new Error('Failed to add note');
      setContent('');
      setIsPrivate(false);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Input label="Add note" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Feedback" />
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private note
      </label>
      <Button size="sm" onClick={submit} disabled={loading || !content}>
        {loading ? 'Saving...' : 'Save note'}
      </Button>
    </div>
  );
}
