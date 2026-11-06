import { userRouter } from '@/lib/trpc/router/user';
import { statsRouter } from '@/lib/trpc/router/stats';
import { coursesRouter } from '@/lib/trpc/router/courses';
import { createTRPCRouter } from '@/lib/trpc/context';

export const appRouter = createTRPCRouter({
  user: userRouter,
  stats: statsRouter,
  courses: coursesRouter,
});

export type AppRouter = typeof appRouter;
