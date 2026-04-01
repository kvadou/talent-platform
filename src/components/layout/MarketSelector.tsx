'use client';
import { Select } from '@/components/ui/Select';

export type MarketOption = { id: string; name: string };

export function MarketSelector({ markets, value, onChange }: { markets: MarketOption[]; value?: string; onChange: (id: string) => void }) {
  return (
    <Select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-none text-white text-sm font-medium focus:ring-0 focus:border-none p-0 h-auto"
    >
      {markets.map((market) => (
        <option key={market.id} value={market.id} className="text-gray-900">
          {market.name}
        </option>
      ))}
    </Select>
  );
}
