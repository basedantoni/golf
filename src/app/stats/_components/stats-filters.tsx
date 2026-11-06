'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OptionSelect } from './option-select';
import { ClubFilter } from './club-filter';
import type { DatePreset, FilterState } from '@/lib/types/stats';
import { getPresetDateRange } from '@/lib/utils/stats';

const ROUND_OPTIONS = [
  { label: 'Last 5 rounds', value: '5' },
  { label: 'Last 10 rounds', value: '10' },
  { label: 'Last 20 rounds', value: '20' },
  { label: 'Last 50 rounds', value: '50' },
  { label: 'All rounds', value: '100' },
];

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Year to date', value: 'ytd' },
  { label: 'Last year', value: '1y' },
  { label: 'All time', value: 'all' },
];

const HOLE_COUNT_OPTIONS: { label: string; value: FilterState['holeCountFilter'] }[] = [
  { label: 'All rounds', value: 'all' },
  { label: '9 hole rounds', value: '9' },
  { label: '18 hole rounds', value: '18' },
];

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Tabs
                value={filters.mode}
                onValueChange={(mode) =>
                  onFilterChange({ ...filters, mode: mode as FilterState['mode'] })
                }
              >
                <TabsList>
                  <TabsTrigger value="lastN">By Rounds</TabsTrigger>
                  <TabsTrigger value="dateRange">By Date</TabsTrigger>
                </TabsList>
              </Tabs>

              {filters.mode === 'lastN' ? (
                <OptionSelect
                  value={String(filters.lastNRounds)}
                  onChange={(n) =>
                    onFilterChange({ ...filters, lastNRounds: parseInt(n, 10) })
                  }
                  options={ROUND_OPTIONS}
                  placeholder="Select rounds"
                />
              ) : (
                <OptionSelect
                  value={filters.datePreset}
                  onChange={(preset) => {
                    const { start, end } = getPresetDateRange(preset);
                    onFilterChange({
                      ...filters,
                      datePreset: preset,
                      startDate: start,
                      endDate: end,
                    });
                  }}
                  options={DATE_PRESETS}
                  placeholder="Select date range"
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <OptionSelect
              value={filters.holeCountFilter}
              onChange={(holeCountFilter) =>
                onFilterChange({ ...filters, holeCountFilter })
              }
              options={HOLE_COUNT_OPTIONS}
              placeholder="Select hole count"
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="fully-logged-only"
                checked={filters.fullyLoggedOnly}
                onCheckedChange={(checked) =>
                  onFilterChange({ ...filters, fullyLoggedOnly: checked === true })
                }
              />
              <label htmlFor="fully-logged-only" className="text-sm leading-none font-medium select-none">
                Fully logged rounds only
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
