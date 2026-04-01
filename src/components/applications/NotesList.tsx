'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { NoteForm } from '@/components/notes/NoteForm';

export function NotesList({ applicationId, notes }: { applicationId: string; notes: any[] }) {
  const [items, setItems] = useState(notes);

  async function refresh() {
    const res = await fetch(`/api/applications/${applicationId}/notes`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.notes);
    }
  }

  return (
    <Card>
      <CardHeader title="Notes" />
      <CardContent className="space-y-4">
        <NoteForm applicationId={applicationId} onCreated={refresh} />
        <div className="space-y-3">
          {items.map((note) => (
            <div key={note.id} className="border border-gray-100 rounded-lg p-3">
              <div className="text-sm text-gray-800">{note.content}</div>
              <div className="text-xs text-gray-500 mt-1">By {note.author.firstName} {note.author.lastName}</div>
            </div>
          ))}
          {items.length === 0 ? <p className="text-sm text-gray-600">No notes yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
