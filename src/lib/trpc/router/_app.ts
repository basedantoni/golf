import { userRouter } from '@/lib/trpc/router/user';
import { statsRouter } from '@/lib/trpc/router/stats';
import { createTRPCRouter } from '@/lib/trpc/context';

export const appRouter = createTRPCRouter({
  user: userRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
