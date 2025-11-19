import { userRouter } from '@/lib/trpc/router/user';
import { createTRPCRouter } from '@/lib/trpc/context';

export const appRouter = createTRPCRouter({
  user: userRouter,
});

export type AppRouter = typeof appRouter;
