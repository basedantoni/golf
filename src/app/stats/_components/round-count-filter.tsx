'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoundCountFilterProps {
  value: number;
  onChange: (value: number) => void;
}

const ROUND_OPTIONS = [
  { label: 'Last 5 rounds', value: 5 },
  { label: 'Last 10 rounds', value: 10 },
  { label: 'Last 20 rounds', value: 20 },
  { label: 'Last 50 rounds', value: 50 },
  { label: 'All rounds', value: 100 },
];

export function RoundCountFilter({ value, onChange }: RoundCountFilterProps) {
  return (
    <Select
      value={value.toString()}
      onValueChange={(v) => onChange(parseInt(v, 10))}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select rounds" />
      </SelectTrigger>
      <SelectContent>
        {ROUND_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
