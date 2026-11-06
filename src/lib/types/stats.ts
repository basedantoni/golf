import type { RouterInputs, RouterOutputs } from "@/lib/trpc";

// Wire types come from the stats router, so they can't drift from what it returns.
export type RoundStatData = RouterOutputs["stats"]["getRoundStats"][number];
export type Club = RouterOutputs["stats"]["getClubs"][number];
export type StatsQueryInput = RouterInputs["stats"]["getRoundStats"];

export type DatePreset = '30d' | '90d' | 'ytd' | '1y' | 'all';

export interface FilterState {
  mode: 'lastN' | 'dateRange';
  lastNRounds: number;
  datePreset: DatePreset;
  startDate: Date | null;
  endDate: Date | null;
  excludeClubIds: string[];
  holeCountFilter: 'all' | '9' | '18';
  fullyLoggedOnly: boolean;
}

export interface ChartDataPoint {
  date: string; // Formatted date for display
  timestamp: number; // For sorting
  value: number;
  label?: string;
}
