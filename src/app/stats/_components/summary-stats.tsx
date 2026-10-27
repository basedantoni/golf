'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatItemProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function StatItem({ label, value, unit, trend, trendValue }: StatItemProps) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? value.toFixed(1) : value}
          {unit && <span className="text-sm font-normal">{unit}</span>}
        </span>
        {trend && trendValue && (
          <span
            className={`flex items-center text-xs ${
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                ? 'text-red-600'
                : 'text-muted-foreground'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3 w-3 mr-1" />
            ) : (
              <Minus className="h-3 w-3 mr-1" />
            )}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}

interface SummaryStatsProps {
  roundCount: number;
  avgScore: number | null;
  avgFairwayPct: number | null;
  avgGirPct: number | null;
  avgPuttsPerRound: number | null;
}

export function SummaryStats({
  roundCount,
  avgScore,
  avgFairwayPct,
  avgGirPct,
  avgPuttsPerRound,
}: SummaryStatsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <StatItem label="Rounds" value={roundCount} />
          <StatItem
            label="Avg Score"
            value={avgScore ?? '-'}
          />
          <StatItem
            label="Fairway Hit %"
            value={avgFairwayPct ?? '-'}
            unit="%"
          />
          <StatItem
            label="GIR %"
            value={avgGirPct ?? '-'}
            unit="%"
          />
          <StatItem
            label="Putts/Round"
            value={avgPuttsPerRound ?? '-'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
