import { format, startOfYear, subDays, subYears } from "date-fns";
import type {
  RoundStatData,
  ChartDataPoint,
  FilterState,
  StatsQueryInput,
} from "@/lib/types/stats";

// Transform round data to chart format
export function toChartData(
  rounds: RoundStatData[],
  valueKey: keyof RoundStatData,
): ChartDataPoint[] {
  return rounds
    .filter((r) => r[valueKey] !== null)
    .map((r) => ({
      date: format(new Date(r.timestamp), "MMM d"),
      timestamp: r.timestamp,
      value: r[valueKey] as number,
      label: r.clubName,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Average of the non-null values, or null if there are none
function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0
    ? present.reduce((sum, v) => sum + v, 0) / present.length
    : null;
}

// Calculate aggregate stats
export function calculateAggregates(rounds: RoundStatData[]) {
  if (rounds.length === 0) return null;

  return {
    roundCount: rounds.length,
    avgScore: average(rounds.map((r) => r.score)),
    avgFairwayPct: average(rounds.map((r) => r.fairwayHitPct)),
    avgGirPct: average(rounds.map((r) => r.girPct)),
    avgPuttsPerRound: average(rounds.map((r) => r.puttsPerRound)),
  };
}

// Preset date ranges
export function getPresetDateRange(preset: string): { start: Date; end: Date } {
  const end = new Date();
  switch (preset) {
    case "30d":
      return { start: subDays(end, 30), end };
    case "90d":
      return { start: subDays(end, 90), end };
    case "1y":
      return { start: subYears(end, 1), end };
    case "ytd":
      return { start: startOfYear(end), end };
    default: // "all" and anything unknown
      return { start: new Date(2000, 0, 1), end };
  }
}

// Timestamps are epoch milliseconds end-to-end (matches rounds.timestamp).
export function buildStatsQueryInput(
  userId: string,
  filters: FilterState,
): StatsQueryInput {
  const byRounds = filters.mode === "lastN";
  return {
    userId,
    holeCountFilter: filters.holeCountFilter,
    fullyLoggedOnly: filters.fullyLoggedOnly,
    lastNRounds: byRounds ? filters.lastNRounds : undefined,
    startDate: !byRounds ? filters.startDate?.getTime() : undefined,
    endDate: !byRounds ? filters.endDate?.getTime() : undefined,
    excludeClubIds: filters.excludeClubIds.length > 0 ? filters.excludeClubIds : undefined,
  };
}
