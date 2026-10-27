"use client";

import { useState, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { StatsFilters } from "./stats-filters";
import { SummaryStats } from "./summary-stats";
import { StatsLineChart } from "./charts/stats-line-chart";
import { StatsBarChart } from "./charts/stats-bar-chart";
import {
  toChartData,
  calculateAggregates,
} from "@/lib/utils/stats";
import type { FilterState } from "@/lib/types/stats";

interface StatsDashboardProps {
  userId: string;
}

export function StatsDashboard({ userId }: StatsDashboardProps) {
  const trpc = useTRPC();

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    mode: "lastN",
    lastNRounds: 20,
    startDate: null,
    endDate: null,
    excludeClubIds: [],
    holeCountFilter: "all",
  });

  // Fetch clubs for filter
  const { data: clubs } = useSuspenseQuery(
    trpc.stats.getClubs.queryOptions({ userId }),
  );

  // Build query input from filter state
  const queryInput = useMemo(() => {
    const input: {
      userId: string;
      lastNRounds?: number;
      startDate?: number;
      endDate?: number;
      excludeClubIds?: string[];
      holeCountFilter?: "all" | "9" | "18";
    } = { userId };

    if (filters.mode === "lastN") {
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

    if (filters.holeCountFilter) {
      input.holeCountFilter = filters.holeCountFilter;
    }

    return input;
  }, [userId, filters]);

  // Fetch stats data
  const { data: roundStats } = useSuspenseQuery(
    trpc.stats.getRoundStats.queryOptions(queryInput),
  );

  // Calculate aggregates
  const aggregates = useMemo(
    () => calculateAggregates(roundStats),
    [roundStats],
  );

  // Prepare chart data
  const fairwayChartData = useMemo(
    () => toChartData(roundStats, "fairwayHitPct"),
    [roundStats],
  );

  const girChartData = useMemo(
    () => toChartData(roundStats, "girPct"),
    [roundStats],
  );

  const puttsChartData = useMemo(
    () => toChartData(roundStats, "putts"),
    [roundStats],
  );
  console.log("Putts Chart Data", puttsChartData);

  const scoreChartData = useMemo(
    () => toChartData(roundStats, "score"),
    [roundStats],
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
      { birdiesOrBetter: 0, pars: 0, bogeys: 0, doublePlus: 0 },
    );

    const total =
      totals.birdiesOrBetter + totals.pars + totals.bogeys + totals.doublePlus;

    if (total === 0) return [];

    return [
      {
        name: "Birdie+",
        value: (totals.birdiesOrBetter / total) * 100,
        color: "#22c55e",
      },
      {
        name: "Par",
        value: (totals.pars / total) * 100,
        color: "#3b82f6",
      },
      {
        name: "Bogey",
        value: (totals.bogeys / total) * 100,
        color: "#f59e0b",
      },
      {
        name: "Double+",
        value: (totals.doublePlus / total) * 100,
        color: "#ef4444",
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
