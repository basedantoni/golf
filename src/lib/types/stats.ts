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
  holeCountFilter: 'all' | '9' | '18';
}

export interface ChartDataPoint {
  date: string; // Formatted date for display
  timestamp: number; // For sorting
  value: number;
  label?: string;
}
