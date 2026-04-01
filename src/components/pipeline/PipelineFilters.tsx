'use client';
import { Input } from '@/components/ui/Input';

export function PipelineFilters({ onSearch }: { onSearch: (term: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Input placeholder="Search candidates" onChange={(e) => onSearch(e.target.value)} />
    </div>
  );
}
