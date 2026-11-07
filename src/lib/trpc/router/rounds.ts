import { TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import { clubs, courseHoles, rounds, roundHoles, roundStats, userPlayedClubs } from '@/lib/db/schema';
import { createRoundInput, roundStatsFromHoles } from '@/lib/utils/round-entry';
import { and, eq } from 'drizzle-orm';

export const roundsRouter = {
  // One Round with its Played Holes and stats, all or nothing
  create: publicProcedure.input(createRoundInput).mutation(async ({ ctx, input }) => {
    const { userId, club, timestamp } = input;
    const holes = input.holes.toSorted((a, b) => a.holeNumber - b.holeNumber);

    return ctx.db.transaction(async (tx) => {
      let clubId: string;
      if ('id' in club) {
        clubId = club.id;
      } else {
        // A new Club gets its Course's Holes, Par Unknown until this Round fills them below.
        [{ id: clubId }] = await tx.insert(clubs).values({ name: club.name }).returning({ id: clubs.id });
        await tx.insert(courseHoles).values(
          Array.from({ length: club.holeCount }, (_, i) => ({ clubId, holeNumber: i + 1, par: null })),
        );
      }

      const strokes = holes.reduce((sum, h) => sum + h.strokes, 0);
      const par = holes.reduce((sum, h) => sum + h.par, 0);
      const [{ id }] = await tx
        .insert(rounds)
        .values({ userId, clubId, timestamp, strokes, score: strokes - par })
        .returning({ id: rounds.id });

      await tx.insert(roundHoles).values(holes.map((h) => ({ roundId: id, ...h })));
      await tx.insert(roundStats).values({ roundId: id, ...roundStatsFromHoles(holes) });
      // Par Unknown Holes take their Usual Par from the first Played Hole on them.
      const course = await tx
        .select({ holeNumber: courseHoles.holeNumber, par: courseHoles.par })
        .from(courseHoles)
        .where(eq(courseHoles.clubId, clubId));
      for (const { holeNumber } of course.filter((h) => h.par === null)) {
        const played = holes.find((h) => (h.holeNumber - 1) % course.length === holeNumber - 1);
        if (!played) continue;
        await tx
          .update(courseHoles)
          .set({ par: played.par })
          .where(and(eq(courseHoles.clubId, clubId), eq(courseHoles.holeNumber, holeNumber)));
      }

      await tx.insert(userPlayedClubs).values({ userId, clubId }).onConflictDoNothing();

      return { id, clubId };
    });
  }),
} satisfies TRPCRouterRecord;
