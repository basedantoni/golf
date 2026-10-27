'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FilterModeToggleProps {
  value: 'lastN' | 'dateRange';
  onChange: (value: 'lastN' | 'dateRange') => void;
}

export function FilterModeToggle({ value, onChange }: FilterModeToggleProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as 'lastN' | 'dateRange')}>
      <TabsList>
        <TabsTrigger value="lastN">By Rounds</TabsTrigger>
        <TabsTrigger value="dateRange">By Date</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
