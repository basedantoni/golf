'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartDataPoint } from '@/lib/types/stats';

interface StatsLineChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKey?: string;
  color?: string;
  unit?: string;
  targetValue?: number;
  targetLabel?: string;
  yDomain?: [number, number];
}

export function StatsLineChart({
  title,
  data,
  dataKey = 'value',
  color = '#2563eb',
  unit = '',
  targetValue,
  targetLabel,
  yDomain,
}: StatsLineChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={yDomain || ['auto', 'auto']}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}${unit}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartDataPoint;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="text-sm font-medium">{data.date}</div>
                        <div className="text-sm text-muted-foreground">
                          {data.value.toFixed(1)}{unit}
                        </div>
                        {data.label && (
                          <div className="text-xs text-muted-foreground">
                            {data.label}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {targetValue !== undefined && (
                <ReferenceLine
                  y={targetValue}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{
                    value: targetLabel || `Target: ${targetValue}${unit}`,
                    position: 'right',
                    fontSize: 10,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
