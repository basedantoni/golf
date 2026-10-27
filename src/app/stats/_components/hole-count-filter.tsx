'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HoleCountFilterProps {
  value: 'all' | '9' | '18';
  onChange: (value: 'all' | '9' | '18') => void;
}

const HOLE_COUNT_OPTIONS = [
  { label: 'All rounds', value: 'all' as const },
  { label: '9 hole rounds', value: '9' as const },
  { label: '18 hole rounds', value: '18' as const },
];

export function HoleCountFilter({ value, onChange }: HoleCountFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as 'all' | '9' | '18')}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select hole count" />
      </SelectTrigger>
      <SelectContent>
        {HOLE_COUNT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
