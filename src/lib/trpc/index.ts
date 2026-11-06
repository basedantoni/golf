import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/lib/trpc/router/_app';
import { appRouter } from '@/lib/trpc/router/_app';
import { createCallerFactory, createTRPCContext } from '@/lib/trpc/context';

// Server-side caller; the router tests' seam (createCaller({ db })).
const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;

type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller };
export type { AppRouter, RouterInputs, RouterOutputs };
