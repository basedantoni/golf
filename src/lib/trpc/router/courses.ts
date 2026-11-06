import { TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import { rounds, clubs, roundHoles } from '@/lib/db/schema';
import { courseParEntry } from '@/lib/db/round-pars';
import { courseProgress, summarizeHoles } from '@/lib/utils/course-holes';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export const coursesRouter = {
  // Courses the user has played, most-played first
  list: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({ id: clubs.id, name: clubs.name, rounds: count() })
        .from(rounds)
        .innerJoin(clubs, eq(rounds.clubId, clubs.id))
        .where(eq(rounds.userId, input.userId))
        .groupBy(clubs.id)
        .orderBy(desc(count()), clubs.name);
    }),

  // Best Result and counts per Hole of one Course, over all the user's Rounds there
  holeResults: publicProcedure
    .input(z.object({ userId: z.string(), clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [club] = await ctx.db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, input.clubId));

      const playedHoles = await ctx.db
        .select({ holeNumber: roundHoles.holeNumber, strokes: roundHoles.strokes, par: roundHoles.par })
        .from(roundHoles)
        .innerJoin(rounds, eq(roundHoles.roundId, rounds.id))
        .where(and(eq(rounds.userId, input.userId), eq(rounds.clubId, input.clubId)));

      // The par file knows the Course's hole count; without an entry, assume no Round wrapped around.
      const course = courseParEntry(input.clubId);
      const holeCount = course?.pars.length ?? Math.max(0, ...playedHoles.map((h) => h.holeNumber));
      const holes = summarizeHoles(playedHoles, holeCount);

      return {
        name: club?.name ?? input.clubId,
        holes,
        progress: courseProgress(holes),
      };
    }),
} satisfies TRPCRouterRecord;
