import { TRPCError, TRPCRouterRecord } from '@trpc/server';
import { publicProcedure } from '@/lib/trpc/context';
import {
  insertUserSchema,
  updateUserSchema,
  userIdSchema,
  users,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const userRouter = {
  all: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(users);
  }),
  create: publicProcedure.input(insertUserSchema).mutation(({ ctx, input }) => {
    return ctx.db.insert(users).values(input);
  }),
  update: publicProcedure.input(updateUserSchema).mutation(({ ctx, input }) => {
    return ctx.db
      .update(users)
      .set(input)
      .where(eq(users.id, input.id as string));
  }),
  delete: publicProcedure.input(userIdSchema).mutation(({ ctx, input }) => {
    console.log('deleting user', input);
    console.log('users', users.id);
    try {
      return ctx.db.delete(users).where(eq(users.id, input.id));
    } catch (error) {
      console.error('Error deleting user', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error deleting user',
      });
    }
  }),
} satisfies TRPCRouterRecord;
