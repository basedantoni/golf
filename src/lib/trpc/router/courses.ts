import { TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import { rounds, clubs, roundHoles, courseHoles } from '@/lib/db/schema';
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

  // Usual Par per Hole (null = Par Unknown); length is the Course's hole count
  usualPars: publicProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const holes = await ctx.db
        .select({ par: courseHoles.par })
        .from(courseHoles)
        .where(eq(courseHoles.clubId, input.clubId))
        .orderBy(courseHoles.holeNumber);
      return holes.map((h) => h.par);
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

      // course_holes knows the Course's hole count; without rows, assume no Round wrapped around.
      const [{ courseHoleCount }] = await ctx.db
        .select({ courseHoleCount: count() })
        .from(courseHoles)
        .where(eq(courseHoles.clubId, input.clubId));
      const holeCount = courseHoleCount || Math.max(0, ...playedHoles.map((h) => h.holeNumber));
      const holes = summarizeHoles(playedHoles, holeCount);

      return {
        name: club?.name ?? input.clubId,
        holes,
        progress: courseProgress(holes),
      };
    }),
} satisfies TRPCRouterRecord;
