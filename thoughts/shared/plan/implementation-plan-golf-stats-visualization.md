# Golf Statistics Visualization Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive golf statistics visualization feature for the existing Next.js 16 application. The feature will allow users to view and analyze their golf performance data through interactive charts with filtering capabilities.

## Current State Analysis

### Existing Architecture
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui (Button, Form, Label, ScrollArea, Separator)
- **API**: tRPC v11 with React Query v5
- **Database**: SQLite with Drizzle ORM (libsql client)
- **State Management**: React Query for server state

### Database Schema (from `src/lib/db/schema.ts`)
The relevant tables are:
- `rounds` - Round metadata (id, userId, clubId, timestamp, score, strokes)
- `round_stats` - Detailed statistics per round including:
  - Scoring: aces, eagles, birdies, pars, bogeys, doubleBogeyOrWorse
  - Fairway: lefts, middles, rights, shorts, longs, holeCount
  - GIR: gir, lefts, rights, shorts, longs, noChances, holeCount
  - Putting: putts, puttHoleCount
  - Stroke Gain: overall, teeToGreen
- `clubs` - Club/course information (id, name)

### Existing Patterns
- tRPC routers use `TRPCRouterRecord` pattern (see `src/lib/trpc/router/user.ts`)
- Client components use `useTRPC()` hook with `useSuspenseQuery`
- Server components use `prefetch(trpc.*.queryOptions())`
- Mutations invalidate queries via `queryClient.invalidateQueries()`

## Desired End State

A `/stats` page with:
1. Interactive line/bar charts showing golf statistics over time
2. Filter controls for date ranges, last N rounds, and club exclusion
3. Responsive design that works on desktop and mobile
4. Server-side data prefetching for fast initial load

### Verification Criteria
- Charts render correctly with seeded data
- Filters update chart data without page reload
- Page loads with prefetched data (no loading spinner on initial load)
- All TypeScript types are properly inferred
- Mobile responsive layout

## What We're NOT Doing

- User authentication/authorization (assuming single user for now)
- Data export functionality
- Comparison between users
- Real-time updates
- Custom date input (will use preset ranges initially)
- Hole-by-hole analysis (roundHoles table not used in this phase)

---

## Implementation Approach

We'll implement this in 4 phases:
1. **Backend/API Layer**: Create tRPC router with stats queries
2. **Dependencies & Setup**: Install Recharts and date-fns
3. **Filter Components**: Build reusable filter UI components
4. **Chart Components & Page**: Build visualizations and assemble the page

---

## Phase 1: Backend API Layer

### Overview
Create a new tRPC router for statistics queries that joins rounds, round_stats, and clubs tables.

### Changes Required:

#### 1. Create Stats Router
**File**: `src/lib/trpc/router/stats.ts`

```typescript
import { TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import { rounds, roundStats, clubs } from '@/lib/db/schema';
import { eq, and, gte, lte, notInArray, desc } from 'drizzle-orm';
import { z } from 'zod';

// Input schema for filtering
const statsFilterSchema = z.object({
  // Date range filter (Unix timestamps)
  startDate: z.number().optional(),
  endDate: z.number().optional(),
  // Last N rounds filter (takes precedence over date range if provided)
  lastNRounds: z.number().min(1).max(100).optional(),
  // Clubs to exclude
  excludeClubIds: z.array(z.string()).optional(),
  // User ID (required)
  userId: z.string(),
});

export type StatsFilter = z.infer<typeof statsFilterSchema>;

export const statsRouter = {
  // Get aggregated stats with filters
  getRoundStats: publicProcedure
    .input(statsFilterSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, lastNRounds, excludeClubIds, userId } = input;

      // Build conditions array
      const conditions = [eq(rounds.userId, userId)];

      if (excludeClubIds && excludeClubIds.length > 0) {
        conditions.push(notInArray(rounds.clubId, excludeClubIds));
      }

      if (!lastNRounds) {
        // Use date range if lastNRounds not specified
        if (startDate) {
          conditions.push(gte(rounds.timestamp, startDate));
        }
        if (endDate) {
          conditions.push(lte(rounds.timestamp, endDate));
        }
      }

      // Build query
      let query = ctx.db
        .select({
          // Round info
          roundId: rounds.id,
          timestamp: rounds.timestamp,
          score: rounds.score,
          strokes: rounds.strokes,
          clubId: rounds.clubId,
          clubName: clubs.name,
          // Scoring stats
          aces: roundStats.aces,
          doubleEagleOrBetter: roundStats.doubleEagleOrBetter,
          eagles: roundStats.eagles,
          birdies: roundStats.birdies,
          pars: roundStats.pars,
          bogeys: roundStats.bogeys,
          doubleBogeyOrWorse: roundStats.doubleBogeyOrWorse,
          // Fairway stats
          fairwayLefts: roundStats.fairwayLefts,
          fairwayMiddles: roundStats.fairwayMiddles,
          fairwayRights: roundStats.fairwayRights,
          fairwayShorts: roundStats.fairwayShorts,
          fairwayLongs: roundStats.fairwayLongs,
          fairwayHoleCount: roundStats.fairwayHoleCount,
          // GIR stats
          gir: roundStats.gir,
          girLefts: roundStats.girLefts,
          girRights: roundStats.girRights,
          girShorts: roundStats.girShorts,
          girLongs: roundStats.girLongs,
          girNoChances: roundStats.girNoChances,
          girHoleCount: roundStats.girHoleCount,
          // Putting stats
          putts: roundStats.putts,
          puttHoleCount: roundStats.puttHoleCount,
          // Stroke gain
          strokeGainOverall: roundStats.strokeGainOverall,
          strokeGainTeeToGreen: roundStats.strokeGainTeeToGreen,
        })
        .from(rounds)
        .innerJoin(roundStats, eq(rounds.id, roundStats.roundId))
        .innerJoin(clubs, eq(rounds.clubId, clubs.id))
        .where(and(...conditions))
        .orderBy(desc(rounds.timestamp));

      // Apply limit if lastNRounds specified
      if (lastNRounds) {
        query = query.limit(lastNRounds) as typeof query;
      }

      const results = await query;

      // Calculate derived metrics for each round
      return results.map((row) => ({
        ...row,
        // Fairway hit percentage (middles / holeCount)
        fairwayHitPct: row.fairwayHoleCount
          ? ((row.fairwayMiddles ?? 0) / row.fairwayHoleCount) * 100
          : null,
        // GIR percentage
        girPct: row.girHoleCount
          ? ((row.gir ?? 0) / row.girHoleCount) * 100
          : null,
        // Putts per hole
        puttsPerHole: row.puttHoleCount
          ? (row.putts ?? 0) / row.puttHoleCount
          : null,
        // Putts per round (normalized to 18 holes)
        puttsPerRound: row.puttHoleCount
          ? ((row.putts ?? 0) / row.puttHoleCount) * 18
          : null,
      }));
    }),

  // Get list of clubs for filter dropdown
  getClubs: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get clubs the user has played
      const playedClubs = await ctx.db
        .selectDistinct({ id: clubs.id, name: clubs.name })
        .from(rounds)
        .innerJoin(clubs, eq(rounds.clubId, clubs.id))
        .where(eq(rounds.userId, input.userId))
        .orderBy(clubs.name);

      return playedClubs;
    }),

  // Get summary/aggregate stats for the filtered data
  getSummaryStats: publicProcedure
    .input(statsFilterSchema)
    .query(async ({ ctx, input }) => {
      // This reuses the getRoundStats logic internally
      // For now, we'll calculate aggregates on the client
      // This procedure could be expanded for server-side aggregation
      return null;
    }),
} satisfies TRPCRouterRecord;
```

#### 2. Register Stats Router
**File**: `src/lib/trpc/router/_app.ts`

```typescript
import { userRouter } from '@/lib/trpc/router/user';
import { statsRouter } from '@/lib/trpc/router/stats';
import { createTRPCRouter } from '@/lib/trpc/context';

export const appRouter = createTRPCRouter({
  user: userRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm build`
- [ ] tRPC router is accessible via API: Start dev server and test `/api/trpc/stats.getRoundStats`
- [ ] Query returns expected data structure with seeded data

#### Manual Verification:
- [ ] Test the API endpoint with various filter combinations
- [ ] Verify JOIN operations return correct club names

---

## Phase 2: Dependencies & Setup

### Overview
Install Recharts for charting and date-fns for date manipulation.

### Changes Required:

#### 1. Install Dependencies
**Command**:
```bash
pnpm add recharts date-fns
```

#### 2. Create Chart Types
**File**: `src/lib/types/stats.ts`

```typescript
// Types for chart data
export interface RoundStatData {
  roundId: string;
  timestamp: number;
  score: number;
  strokes: number;
  clubId: string;
  clubName: string;
  // Calculated percentages
  fairwayHitPct: number | null;
  girPct: number | null;
  puttsPerHole: number | null;
  puttsPerRound: number | null;
  // Raw stats (for detailed views)
  fairwayMiddles: number | null;
  fairwayHoleCount: number | null;
  gir: number | null;
  girHoleCount: number | null;
  putts: number | null;
  puttHoleCount: number | null;
  birdies: number | null;
  pars: number | null;
  bogeys: number | null;
}

export interface FilterState {
  mode: 'lastN' | 'dateRange';
  lastNRounds: number;
  startDate: Date | null;
  endDate: Date | null;
  excludeClubIds: string[];
}

export interface ChartDataPoint {
  date: string; // Formatted date for display
  timestamp: number; // For sorting
  value: number;
  label?: string;
}
```

#### 3. Create Stats Utility Functions
**File**: `src/lib/utils/stats.ts`

```typescript
import { format } from 'date-fns';
import type { RoundStatData, ChartDataPoint } from '@/lib/types/stats';

// Transform round data to chart format
export function toChartData(
  rounds: RoundStatData[],
  valueKey: keyof RoundStatData,
  dateFormat = 'MMM d'
): ChartDataPoint[] {
  return rounds
    .filter((r) => r[valueKey] !== null)
    .map((r) => ({
      date: format(new Date(r.timestamp * 1000), dateFormat),
      timestamp: r.timestamp,
      value: r[valueKey] as number,
      label: r.clubName,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Calculate moving average for trend lines
export function movingAverage(
  data: ChartDataPoint[],
  windowSize: number
): ChartDataPoint[] {
  if (data.length < windowSize) return [];

  return data.slice(windowSize - 1).map((point, index) => {
    const window = data.slice(index, index + windowSize);
    const avg = window.reduce((sum, p) => sum + p.value, 0) / windowSize;
    return { ...point, value: Math.round(avg * 10) / 10 };
  });
}

// Calculate aggregate stats
export function calculateAggregates(rounds: RoundStatData[]) {
  if (rounds.length === 0) return null;

  const validFairway = rounds.filter((r) => r.fairwayHitPct !== null);
  const validGir = rounds.filter((r) => r.girPct !== null);
  const validPutts = rounds.filter((r) => r.puttsPerRound !== null);

  return {
    roundCount: rounds.length,
    avgScore: rounds.reduce((sum, r) => sum + r.score, 0) / rounds.length,
    avgFairwayPct:
      validFairway.length > 0
        ? validFairway.reduce((sum, r) => sum + (r.fairwayHitPct ?? 0), 0) /
          validFairway.length
        : null,
    avgGirPct:
      validGir.length > 0
        ? validGir.reduce((sum, r) => sum + (r.girPct ?? 0), 0) / validGir.length
        : null,
    avgPuttsPerRound:
      validPutts.length > 0
        ? validPutts.reduce((sum, r) => sum + (r.puttsPerRound ?? 0), 0) /
          validPutts.length
        : null,
  };
}

// Preset date ranges
export function getPresetDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (preset) {
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      start = new Date(2000, 0, 1); // Far past date
      break;
  }

  return { start, end };
}
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies install successfully: `pnpm install`
- [x] TypeScript compiles with new types: `pnpm build`
- [x] No type errors in utility functions

#### Manual Verification:
- [x] Verify recharts is available for import

---

## Phase 3: Filter Components

### Overview
Create reusable filter components for the stats page using shadcn/ui patterns.

### Changes Required:

#### 1. Add Required shadcn/ui Components
**Command** (run these to add shadcn components):
```bash
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add checkbox
pnpm dlx shadcn@latest add popover
pnpm dlx shadcn@latest add command
```

#### 2. Create Round Count Filter
**File**: `src/app/stats/_components/round-count-filter.tsx`

```typescript
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
```

#### 3. Create Date Range Filter
**File**: `src/app/stats/_components/date-range-filter.tsx`

```typescript
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateRangeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const DATE_PRESETS = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Year to date', value: 'ytd' },
  { label: 'Last year', value: '1y' },
  { label: 'All time', value: 'all' },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select date range" />
      </SelectTrigger>
      <SelectContent>
        {DATE_PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### 4. Create Club Exclusion Filter
**File**: `src/app/stats/_components/club-filter.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Filter } from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

interface ClubFilterProps {
  clubs: Club[];
  excludedIds: string[];
  onChange: (excludedIds: string[]) => void;
}

export function ClubFilter({ clubs, excludedIds, onChange }: ClubFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleClub = (clubId: string) => {
    if (excludedIds.includes(clubId)) {
      onChange(excludedIds.filter((id) => id !== clubId));
    } else {
      onChange([...excludedIds, clubId]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            Filter Clubs
            {excludedIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {excludedIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Exclude Clubs</span>
              {excludedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-auto p-1 text-xs"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-2 space-y-1">
              {clubs.map((club) => (
                <label
                  key={club.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={excludedIds.includes(club.id)}
                    onCheckedChange={() => toggleClub(club.id)}
                  />
                  <span className="text-sm">{club.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Show excluded clubs as badges */}
      <div className="flex flex-wrap gap-1">
        {excludedIds.slice(0, 3).map((id) => {
          const club = clubs.find((c) => c.id === id);
          return club ? (
            <Badge key={id} variant="secondary" className="text-xs">
              {club.name}
              <button
                onClick={() => toggleClub(id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : null;
        })}
        {excludedIds.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{excludedIds.length - 3} more
          </Badge>
        )}
      </div>
    </div>
  );
}
```

#### 5. Create Filter Mode Toggle
**File**: `src/app/stats/_components/filter-mode-toggle.tsx`

```typescript
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
```

#### 6. Create Combined Stats Filter Component
**File**: `src/app/stats/_components/stats-filters.tsx`

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FilterModeToggle } from './filter-mode-toggle';
import { RoundCountFilter } from './round-count-filter';
import { DateRangeFilter } from './date-range-filter';
import { ClubFilter } from './club-filter';
import type { FilterState } from '@/lib/types/stats';

interface Club {
  id: string;
  name: string;
}

interface StatsFiltersProps {
  filters: FilterState;
  clubs: Club[];
  onFilterChange: (filters: FilterState) => void;
}

export function StatsFilters({
  filters,
  clubs,
  onFilterChange,
}: StatsFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <FilterModeToggle
              value={filters.mode}
              onChange={(mode) => onFilterChange({ ...filters, mode })}
            />

            {filters.mode === 'lastN' ? (
              <RoundCountFilter
                value={filters.lastNRounds}
                onChange={(lastNRounds) =>
                  onFilterChange({ ...filters, lastNRounds })
                }
              />
            ) : (
              <DateRangeFilter
                value={
                  filters.startDate && filters.endDate
                    ? 'custom'
                    : 'all'
                }
                onChange={(preset) => {
                  // Convert preset to dates using utility
                  const { getPresetDateRange } = require('@/lib/utils/stats');
                  const { start, end } = getPresetDateRange(preset);
                  onFilterChange({
                    ...filters,
                    startDate: start,
                    endDate: end,
                  });
                }}
              />
            )}
          </div>

          <ClubFilter
            clubs={clubs}
            excludedIds={filters.excludeClubIds}
            onChange={(excludeClubIds) =>
              onFilterChange({ ...filters, excludeClubIds })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm build`
- [x] All shadcn components installed successfully
- [x] No ESLint errors: `pnpm lint`

#### Manual Verification:
- [ ] Filter components render correctly in isolation
- [ ] State changes propagate correctly through callbacks

---

## Phase 4: Chart Components & Page

### Overview
Create Recharts-based visualization components and assemble the final stats page.

### Changes Required:

#### 1. Create Line Chart Component (for trends)
**File**: `src/app/stats/_components/charts/stats-line-chart.tsx`

```typescript
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
```

#### 2. Create Bar Chart Component (for distributions)
**File**: `src/app/stats/_components/charts/stats-bar-chart.tsx`

```typescript
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

interface StatsBarChartProps {
  title: string;
  data: BarChartData[];
  unit?: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#22c55e', // green - birdies
  '#3b82f6', // blue - pars
  '#f59e0b', // amber - bogeys
  '#ef4444', // red - double+
];

export function StatsBarChart({
  title,
  data,
  unit = '',
  colors = DEFAULT_COLORS,
}: StatsBarChartProps) {
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
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}${unit}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as BarChartData;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="text-sm font-medium">{data.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {data.value.toFixed(1)}{unit}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || colors[index % colors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3. Create Summary Stats Card
**File**: `src/app/stats/_components/summary-stats.tsx`

```typescript
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
```

#### 4. Create Stats Page Client Component
**File**: `src/app/stats/_components/stats-dashboard.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/react';
import { StatsFilters } from './stats-filters';
import { SummaryStats } from './summary-stats';
import { StatsLineChart } from './charts/stats-line-chart';
import { StatsBarChart } from './charts/stats-bar-chart';
import {
  toChartData,
  calculateAggregates,
  getPresetDateRange,
} from '@/lib/utils/stats';
import type { FilterState } from '@/lib/types/stats';

interface StatsDashboardProps {
  userId: string;
}

export function StatsDashboard({ userId }: StatsDashboardProps) {
  const trpc = useTRPC();

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    mode: 'lastN',
    lastNRounds: 20,
    startDate: null,
    endDate: null,
    excludeClubIds: [],
  });

  // Fetch clubs for filter
  const { data: clubs } = useSuspenseQuery(
    trpc.stats.getClubs.queryOptions({ userId })
  );

  // Build query input from filter state
  const queryInput = useMemo(() => {
    const input: {
      userId: string;
      lastNRounds?: number;
      startDate?: number;
      endDate?: number;
      excludeClubIds?: string[];
    } = { userId };

    if (filters.mode === 'lastN') {
      input.lastNRounds = filters.lastNRounds;
    } else {
      if (filters.startDate) {
        input.startDate = Math.floor(filters.startDate.getTime() / 1000);
      }
      if (filters.endDate) {
        input.endDate = Math.floor(filters.endDate.getTime() / 1000);
      }
    }

    if (filters.excludeClubIds.length > 0) {
      input.excludeClubIds = filters.excludeClubIds;
    }

    return input;
  }, [userId, filters]);

  // Fetch stats data
  const { data: roundStats } = useSuspenseQuery(
    trpc.stats.getRoundStats.queryOptions(queryInput)
  );

  // Calculate aggregates
  const aggregates = useMemo(
    () => calculateAggregates(roundStats),
    [roundStats]
  );

  // Prepare chart data
  const fairwayChartData = useMemo(
    () => toChartData(roundStats, 'fairwayHitPct'),
    [roundStats]
  );

  const girChartData = useMemo(
    () => toChartData(roundStats, 'girPct'),
    [roundStats]
  );

  const puttsChartData = useMemo(
    () => toChartData(roundStats, 'puttsPerRound'),
    [roundStats]
  );

  const scoreChartData = useMemo(
    () => toChartData(roundStats, 'score'),
    [roundStats]
  );

  // Prepare scoring distribution data (aggregate across all rounds)
  const scoringDistribution = useMemo(() => {
    const totals = roundStats.reduce(
      (acc, round) => ({
        birdiesOrBetter:
          acc.birdiesOrBetter +
          (round.birdies ?? 0) +
          (round.eagles ?? 0) +
          (round.aces ?? 0),
        pars: acc.pars + (round.pars ?? 0),
        bogeys: acc.bogeys + (round.bogeys ?? 0),
        doublePlus: acc.doublePlus + (round.doubleBogeyOrWorse ?? 0),
      }),
      { birdiesOrBetter: 0, pars: 0, bogeys: 0, doublePlus: 0 }
    );

    const total =
      totals.birdiesOrBetter +
      totals.pars +
      totals.bogeys +
      totals.doublePlus;

    if (total === 0) return [];

    return [
      {
        name: 'Birdie+',
        value: (totals.birdiesOrBetter / total) * 100,
        color: '#22c55e',
      },
      {
        name: 'Par',
        value: (totals.pars / total) * 100,
        color: '#3b82f6',
      },
      {
        name: 'Bogey',
        value: (totals.bogeys / total) * 100,
        color: '#f59e0b',
      },
      {
        name: 'Double+',
        value: (totals.doublePlus / total) * 100,
        color: '#ef4444',
      },
    ];
  }, [roundStats]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <StatsFilters
        filters={filters}
        clubs={clubs}
        onFilterChange={setFilters}
      />

      {/* Summary Stats */}
      <SummaryStats
        roundCount={aggregates?.roundCount ?? 0}
        avgScore={aggregates?.avgScore ?? null}
        avgFairwayPct={aggregates?.avgFairwayPct ?? null}
        avgGirPct={aggregates?.avgGirPct ?? null}
        avgPuttsPerRound={aggregates?.avgPuttsPerRound ?? null}
      />

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <StatsLineChart
          title="Fairway Hit %"
          data={fairwayChartData}
          color="#22c55e"
          unit="%"
          yDomain={[0, 100]}
          targetValue={60}
          targetLabel="Target: 60%"
        />

        <StatsLineChart
          title="Greens in Regulation %"
          data={girChartData}
          color="#3b82f6"
          unit="%"
          yDomain={[0, 100]}
          targetValue={50}
          targetLabel="Target: 50%"
        />

        <StatsLineChart
          title="Putts per Round"
          data={puttsChartData}
          color="#8b5cf6"
          targetValue={32}
          targetLabel="Target: 32"
        />

        <StatsLineChart
          title="Score Trend"
          data={scoreChartData}
          color="#f59e0b"
        />

        <StatsBarChart
          title="Scoring Distribution"
          data={scoringDistribution}
          unit="%"
        />
      </div>
    </div>
  );
}
```

#### 5. Create Stats Page (Server Component)
**File**: `src/app/stats/page.tsx`

```typescript
import { Suspense } from 'react';
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server';
import { StatsDashboard } from './_components/stats-dashboard';

// For now, hardcode user ID - this would come from auth in real app
const DEFAULT_USER_ID = 'user_id_from_seed'; // Replace with actual seeded user ID

export default async function StatsPage() {
  // Prefetch initial data
  prefetch(
    trpc.stats.getRoundStats.queryOptions({
      userId: DEFAULT_USER_ID,
      lastNRounds: 20,
    })
  );
  prefetch(trpc.stats.getClubs.queryOptions({ userId: DEFAULT_USER_ID }));

  return (
    <HydrateClient>
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Golf Statistics
            </h1>
            <p className="text-muted-foreground">
              Track your performance and identify areas for improvement
            </p>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Loading stats...</div>
              </div>
            }
          >
            <StatsDashboard userId={DEFAULT_USER_ID} />
          </Suspense>
        </div>
      </main>
    </HydrateClient>
  );
}
```

#### 6. Update Page to Get User ID from Seed Data
After seeding, update the `DEFAULT_USER_ID` in `src/app/stats/page.tsx` to match the actual user ID from your seed data. You can find this by checking the `data.json` file or querying the database.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm build`
- [x] No ESLint errors: `pnpm lint`
- [x] Dev server starts without errors: `pnpm dev`

#### Manual Verification:
- [ ] Navigate to `/stats` page and verify charts render
- [ ] Test filter controls (round count, date range, club exclusion)
- [ ] Verify charts update when filters change
- [ ] Check responsive layout on mobile viewport
- [ ] Verify tooltips appear on chart hover
- [ ] Confirm summary stats calculate correctly

---

## Testing Strategy

### Unit Tests (Future Enhancement)
- Test utility functions in `src/lib/utils/stats.ts`
- Test filter state transformations
- Test chart data transformations

### Integration Tests (Future Enhancement)
- Test tRPC router queries with mock database
- Test filter -> query -> chart data flow

### Manual Testing Steps
1. Seed the database: `pnpm db:seed`
2. Start dev server: `pnpm dev`
3. Navigate to `http://localhost:3000/stats`
4. Verify initial data loads (charts should show data)
5. Change "Last N rounds" filter - verify charts update
6. Switch to "By Date" mode - verify date range filter works
7. Exclude a club - verify that club's rounds are filtered out
8. Test on mobile viewport - verify responsive layout
9. Check browser console for errors

---

## Dependencies Summary

### New npm Packages
```json
{
  "recharts": "^2.x",
  "date-fns": "^3.x"
}
```

### New shadcn/ui Components
- `select` - For dropdowns
- `card` - For chart containers
- `tabs` - For filter mode toggle
- `badge` - For showing excluded clubs
- `checkbox` - For club selection
- `popover` - For club filter dropdown
- `command` - For searchable lists (optional)

---

## File Structure Summary

### New Files to Create
```
src/
├── app/
│   └── stats/
│       ├── page.tsx                          # Server component page
│       └── _components/
│           ├── stats-dashboard.tsx           # Main client component
│           ├── stats-filters.tsx             # Combined filter component
│           ├── filter-mode-toggle.tsx        # Round/Date toggle
│           ├── round-count-filter.tsx        # Last N rounds dropdown
│           ├── date-range-filter.tsx         # Date preset dropdown
│           ├── club-filter.tsx               # Club exclusion filter
│           ├── summary-stats.tsx             # Aggregate stats display
│           └── charts/
│               ├── stats-line-chart.tsx      # Trend line chart
│               └── stats-bar-chart.tsx       # Distribution bar chart
├── lib/
│   ├── types/
│   │   └── stats.ts                          # TypeScript types
│   ├── utils/
│   │   └── stats.ts                          # Utility functions
│   └── trpc/
│       └── router/
│           └── stats.ts                      # Stats tRPC router
└── components/
    └── ui/
        ├── select.tsx                        # (via shadcn)
        ├── card.tsx                          # (via shadcn)
        ├── tabs.tsx                          # (via shadcn)
        ├── badge.tsx                         # (via shadcn)
        ├── checkbox.tsx                      # (via shadcn)
        ├── popover.tsx                       # (via shadcn)
        └── command.tsx                       # (via shadcn)
```

### Files to Modify
```
src/lib/trpc/router/_app.ts                   # Add stats router
```

---

## Performance Considerations

1. **Server-side Prefetching**: Initial data is prefetched on the server via tRPC, eliminating loading spinners on first render.

2. **Memoization**: Chart data transformations are memoized with `useMemo` to prevent unnecessary recalculations.

3. **Query Caching**: React Query automatically caches responses. Switching between filter presets with the same parameters will use cached data.

4. **Lazy Loading**: Consider code-splitting the Recharts library in future if bundle size becomes an issue.

5. **Database Indexes**: The schema already has indexes on `rounds.timestamp` and `rounds.userId` which will optimize filter queries.

---

## Future Enhancements (Out of Scope)

- Custom date range picker (calendar input)
- Moving average trend lines overlay
- Comparison between time periods
- Export data to CSV
- Stroke Gain analysis charts
- Hole-by-hole analysis
- Club-specific performance breakdown
- Goal setting and tracking
