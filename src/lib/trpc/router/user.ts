import { TRPCError, TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import {
  insertUserSchema,
  updateUserSchema,
  userIdSchema,
  users,
} from '@/lib/db/schema';
import { DrizzleQueryError, eq } from 'drizzle-orm';

// SQLite refuses to delete a row other rows still reference.
const isForeignKeyViolation = (error: unknown) =>
  error instanceof DrizzleQueryError &&
  (error.cause as { code?: string } | undefined)?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY';

export const userRouter = {
  all: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(users);
  }),
  create: publicProcedure.input(insertUserSchema).mutation(({ ctx, input }) => {
    return ctx.db.insert(users).values(input);
  }),
  update: publicProcedure
    .input(
      updateUserSchema
        .required({ id: true })
        .refine((input) => Object.entries(input).some(([key, v]) => key !== 'id' && v !== undefined), 'Nothing to update'),
    )
    .mutation(({ ctx, input }) => {
      // id selects the row; it is never part of the update itself
      const { id, ...data } = input;
      return ctx.db.update(users).set(data).where(eq(users.id, id));
    }),
  delete: publicProcedure.input(userIdSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.delete(users).where(eq(users.id, input.id));
    } catch (error) {
      // The user's Rounds reference them; refuse rather than orphan the history.
      if (isForeignKeyViolation(error)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete user: user has existing rounds',
          cause: error,
        });
      }
      throw error;
    }
  }),
} satisfies TRPCRouterRecord;
