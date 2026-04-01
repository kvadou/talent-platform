'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

async function trigger(path: string, setMessage: (m: string) => void) {
  const res = await fetch(path, { method: 'POST' });
  const data = await res.json();
  setMessage(data.message ?? 'Triggered');
}

export default function MigrationsPage() {
  const [message, setMessage] = useState('');
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Migration Tools</h1>
      <Card>
        <CardHeader title="Greenhouse Import" />
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">Trigger Greenhouse import job.</p>
          <Button size="sm" onClick={() => trigger('/api/admin/migrations/import-greenhouse', setMessage)}>Run import</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Contractor Export" />
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">Export hired candidates to contractors table.</p>
          <Button size="sm" onClick={() => trigger('/api/admin/migrations/export-contractors', setMessage)}>Run export</Button>
        </CardContent>
      </Card>
      {message ? <p className="text-sm text-success-700">{message}</p> : null}
    </div>
  );
}
