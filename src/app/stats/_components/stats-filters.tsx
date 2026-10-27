'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FilterModeToggle } from './filter-mode-toggle';
import { RoundCountFilter } from './round-count-filter';
import { DateRangeFilter } from './date-range-filter';
import { ClubFilter } from './club-filter';
import { HoleCountFilter } from './hole-count-filter';
import type { FilterState } from '@/lib/types/stats';
import { getPresetDateRange } from '@/lib/utils/stats';

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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <HoleCountFilter
              value={filters.holeCountFilter}
              onChange={(holeCountFilter) =>
                onFilterChange({ ...filters, holeCountFilter })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
