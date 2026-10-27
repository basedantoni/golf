import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toChartData,
  movingAverage,
  calculateAggregates,
  getPresetDateRange,
} from '@/lib/utils/stats';
import type { RoundStatData, ChartDataPoint } from '@/lib/types/stats';

// Local time, so date-fns' local-time formatting is timezone independent.
const JAN_15_NOON = new Date(2026, 0, 15, 12).getTime();

function round(overrides: Partial<RoundStatData> = {}): RoundStatData {
  return {
    roundId: 'r1',
    timestamp: JAN_15_NOON,
    score: 0,
    strokes: 72,
    clubId: 'c1',
    clubName: 'Pebble',
    fairwayHitPct: null,
    girPct: null,
    puttsPerHole: null,
    puttsPerRound: null,
    fairwayMiddles: null,
    fairwayHoleCount: null,
    gir: null,
    girHoleCount: null,
    putts: null,
    puttHoleCount: null,
    birdies: null,
    pars: null,
    bogeys: null,
    ...overrides,
  };
}

function point(value: number, timestamp: number): ChartDataPoint {
  return { date: `d${timestamp}`, timestamp, value };
}

describe('toChartData', () => {
  it('drops rounds whose value is null', () => {
    const data = toChartData(
      [round({ roundId: 'a', girPct: 50 }), round({ roundId: 'b', girPct: null })],
      'girPct',
    );
    expect(data.map((d) => d.value)).toEqual([50]);
  });

  it('sorts ascending by timestamp when given DESC input', () => {
    const data = toChartData(
      [
        round({ timestamp: 3000, score: 3 }),
        round({ timestamp: 2000, score: 2 }),
        round({ timestamp: 1000, score: 1 }),
      ],
      'score',
    );
    expect(data.map((d) => d.timestamp)).toEqual([1000, 2000, 3000]);
    expect(data.map((d) => d.value)).toEqual([1, 2, 3]);
  });

  it('formats the date from an epoch-ms timestamp and maps clubName to label', () => {
    const [p] = toChartData(
      [round({ timestamp: JAN_15_NOON, clubName: 'Augusta', score: 4 })],
      'score',
    );
    expect(p).toEqual({
      date: 'Jan 15',
      timestamp: JAN_15_NOON,
      value: 4,
      label: 'Augusta',
    });
  });

  it('honours a custom date format', () => {
    const [p] = toChartData([round({ score: 1 })], 'score', 'yyyy-MM-dd');
    expect(p.date).toBe('2026-01-15');
  });
});

describe('movingAverage', () => {
  it('returns [] when there are fewer points than the window', () => {
    expect(movingAverage([point(1, 1), point(2, 2)], 3)).toEqual([]);
  });

  it('returns one trailing-window mean per window end', () => {
    const data = [point(1, 1), point(2, 2), point(3, 3), point(4, 4)];
    expect(movingAverage(data, 2).map((p) => p.value)).toEqual([1.5, 2.5, 3.5]);
  });

  it('rounds to 1 decimal', () => {
    const data = [point(1, 1), point(1, 2), point(2, 3)];
    expect(movingAverage(data, 3).map((p) => p.value)).toEqual([1.3]);
  });

  it("keeps the window-end point's date and timestamp", () => {
    const data = [point(10, 100), point(20, 200), point(30, 300)];
    expect(movingAverage(data, 2)).toEqual([
      { date: 'd200', timestamp: 200, value: 15 },
      { date: 'd300', timestamp: 300, value: 25 },
    ]);
  });
});

describe('calculateAggregates', () => {
  it('returns null for no rounds', () => {
    expect(calculateAggregates([])).toBeNull();
  });

  it('averages score over all rounds and each metric over rounds that have it', () => {
    const result = calculateAggregates([
      round({ score: 2, fairwayHitPct: 50, girPct: null, putts: 30 }),
      round({ score: 4, fairwayHitPct: null, girPct: 40, putts: null }),
      round({ score: 6, fairwayHitPct: 70, girPct: null, putts: 34 }),
    ]);
    expect(result).toEqual({
      roundCount: 3,
      avgScore: 4,
      avgFairwayPct: 60,
      avgGirPct: 40,
      avgPuttsPerRound: 32,
    });
  });

  it('returns null for a metric no round has while others still compute', () => {
    const result = calculateAggregates([
      round({ score: 1, putts: 28 }),
      round({ score: 3, putts: 32 }),
    ]);
    expect(result).toEqual({
      roundCount: 2,
      avgScore: 2,
      avgFairwayPct: null,
      avgGirPct: null,
      avgPuttsPerRound: 30,
    });
  });
});

describe('getPresetDateRange', () => {
  const NOW = Date.UTC(2026, 5, 15, 10);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['30d', Date.UTC(2026, 4, 16, 10)],
    ['90d', Date.UTC(2026, 2, 17, 10)],
    ['1y', Date.UTC(2025, 5, 15, 10)],
  ])('%s starts a fixed span before now and ends now', (preset, start) => {
    const range = getPresetDateRange(preset);
    expect(range.start.getTime()).toBe(start);
    expect(range.end.getTime()).toBe(NOW);
  });

  it('ytd starts at local midnight on Jan 1 of the current year', () => {
    expect(getPresetDateRange('ytd').start).toEqual(new Date(2026, 0, 1));
  });

  it.each(['all', 'bogus'])('%s starts at 2000-01-01 local time', (preset) => {
    expect(getPresetDateRange(preset).start).toEqual(new Date(2000, 0, 1));
  });
});
