import { TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import { rounds, roundStats, clubs, roundHoles } from '@/lib/db/schema';
import { eq, and, gte, lte, notInArray, desc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';

// Input schema for filtering
const statsFilterSchema = z.object({
  // Date range filter (epoch milliseconds — matches rounds.timestamp)
  startDate: z.number().optional(),
  endDate: z.number().optional(),
  // Last N rounds filter (takes precedence over date range if provided)
  lastNRounds: z.number().min(1).max(100).optional(),
  // Clubs to exclude
  excludeClubIds: z.array(z.string()).optional(),
  // Hole count filter (9, 18, or all)
  holeCountFilter: z.enum(['all', '9', '18']).optional(),
  // Only rounds with fairway, GIR and putt results logged on every hole
  fullyLoggedOnly: z.boolean().optional(),
  // User ID (required)
  userId: z.string(),
});

export type StatsFilter = z.infer<typeof statsFilterSchema>;

export const statsRouter = {
  // Get aggregated stats with filters
  getRoundStats: publicProcedure
    .input(statsFilterSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, lastNRounds, excludeClubIds, userId, holeCountFilter, fullyLoggedOnly } = input;

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

      if (fullyLoggedOnly) {
        const holeCount = sql`(select count(*) from ${roundHoles} where ${roundHoles.roundId} = ${rounds.id})`;
        // Results per direction must add up to the tracked hole counts; the
        // export has only a putt total, so at least one putt per hole is the best check.
        conditions.push(sql`${roundStats.fairwayHoleCount} > 0
          and ${roundStats.fairwayLefts} + ${roundStats.fairwayMiddles} + ${roundStats.fairwayRights}
            + ${roundStats.fairwayShorts} + ${roundStats.fairwayLongs} = ${roundStats.fairwayHoleCount}
          and ${roundStats.girHoleCount} = ${holeCount}
          and ${roundStats.gir} + ${roundStats.girLefts} + ${roundStats.girRights} + ${roundStats.girShorts}
            + ${roundStats.girLongs} + ${roundStats.girNoChances} = ${roundStats.girHoleCount}
          and ${roundStats.putts} >= ${holeCount}`);
      }

      // Handle hole count filter — uncorrelated subquery, single statement
      if (holeCountFilter && holeCountFilter !== 'all') {
        const targetHoleCount = parseInt(holeCountFilter, 10);

        const roundIdsWithHoleCount = ctx.db
          .select({ roundId: roundHoles.roundId })
          .from(roundHoles)
          .groupBy(roundHoles.roundId)
          .having(sql`count(*) = ${targetHoleCount}`);

        conditions.push(inArray(rounds.id, roundIdsWithHoleCount));
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
} satisfies TRPCRouterRecord;
