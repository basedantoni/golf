'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { calculateAggregates } from '@/lib/utils/stats';

interface StatItemProps {
  label: string;
  value: string | number;
  unit?: string;
}

function StatItem({ label, value, unit }: StatItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold">
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-sm font-normal">{unit}</span>}
      </span>
    </div>
  );
}

interface SummaryStatsProps {
  aggregates: ReturnType<typeof calculateAggregates>;
}

export function SummaryStats({ aggregates }: SummaryStatsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <StatItem label="Rounds" value={aggregates?.roundCount ?? 0} />
          <StatItem label="Avg Score" value={aggregates?.avgScore ?? '-'} />
          <StatItem
            label="Fairway Hit %"
            value={aggregates?.avgFairwayPct ?? '-'}
            unit="%"
          />
          <StatItem label="GIR %" value={aggregates?.avgGirPct ?? '-'} unit="%" />
          <StatItem
            label="Putts/Round"
            value={aggregates?.avgPuttsPerRound ?? '-'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
