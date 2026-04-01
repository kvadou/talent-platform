'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function CandidateInfo({
  candidate,
  jobTitle,
  stage
}: {
  candidate: any;
  jobTitle: string;
  stage: string;
}) {
  const [primaryEmail, setPrimaryEmail] = useState(candidate.email);
  const [secondaryEmail, setSecondaryEmail] = useState(candidate.secondaryEmail || null);
  const [swapping, setSwapping] = useState(false);

  const handleSwapEmails = async () => {
    if (!secondaryEmail) return;
    setSwapping(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'swap-emails' }),
      });
      if (res.ok) {
        const old = primaryEmail;
        setPrimaryEmail(secondaryEmail);
        setSecondaryEmail(old);
      }
    } catch (err) {
      console.error('Failed to swap emails:', err);
    } finally {
      setSwapping(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Candidate" />
      <CardContent className="space-y-2 text-sm text-gray-700">
        <div className="text-lg font-semibold text-gray-900">
          {candidate.firstName} {candidate.lastName}
        </div>
        <div className="flex items-center gap-1.5">
          <span>{primaryEmail}</span>
          <span className="text-xs text-purple-600 font-medium">(primary)</span>
        </div>
        {secondaryEmail && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">{secondaryEmail}</span>
            <span className="text-xs text-gray-400">(from resume)</span>
            <button
              onClick={handleSwapEmails}
              disabled={swapping}
              className="text-xs text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
            >
              {swapping ? 'Swapping...' : 'Make primary'}
            </button>
          </div>
        )}
        {candidate.phone ? <div>{candidate.phone}</div> : null}
        <div className="text-xs text-gray-500">Stage: {stage}</div>
        <div className="text-xs text-gray-500">Job: {jobTitle}</div>
        {candidate.city || candidate.state ? <div>{candidate.city ?? ''} {candidate.state ?? ''}</div> : null}
        {candidate.tags?.length ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {candidate.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-100 rounded-lg">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
