import { format } from "date-fns";
import type { RoundStatData, ChartDataPoint } from "@/lib/types/stats";

// Transform round data to chart format
export function toChartData(
  rounds: RoundStatData[],
  valueKey: keyof RoundStatData,
  dateFormat = "MMM d",
): ChartDataPoint[] {
  return rounds
    .filter((r) => r[valueKey] !== null)
    .map((r) => ({
      date: format(new Date(r.timestamp), dateFormat),
      timestamp: r.timestamp,
      value: r[valueKey] as number,
      label: r.clubName,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Calculate moving average for trend lines
export function movingAverage(
  data: ChartDataPoint[],
  windowSize: number,
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
  const validPutts = rounds.filter((r) => r.putts !== null);

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
        ? validGir.reduce((sum, r) => sum + (r.girPct ?? 0), 0) /
          validGir.length
        : null,
    avgPuttsPerRound:
      validPutts.length > 0
        ? validPutts.reduce((sum, r) => sum + (r.putts ?? 0), 0) /
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
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      start = new Date(2000, 0, 1); // Far past date
      break;
  }

  return { start, end };
}
