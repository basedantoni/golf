import { Suspense } from 'react';
import Link from 'next/link';
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server';
import { DEFAULT_USER_ID } from '@/lib/user';
import { buttonVariants } from '@/components/ui/button';
import { StatsDashboard } from './_components/stats-dashboard';

export default async function StatsPage() {
  // Prefetch initial data
  prefetch(
    trpc.stats.getRoundStats.queryOptions({
      userId: DEFAULT_USER_ID,
      lastNRounds: 20,
    })
  );
  prefetch(trpc.stats.getClubs.queryOptions({ userId: DEFAULT_USER_ID }));

  return (
    <HydrateClient>
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Golf Statistics
              </h1>
              <p className="text-muted-foreground">
                Track your performance and identify areas for improvement
              </p>
            </div>
            <Link href="/rounds/new" className={buttonVariants()}>
              New round
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Loading stats...</div>
              </div>
            }
          >
            <StatsDashboard userId={DEFAULT_USER_ID} />
          </Suspense>
        </div>
      </main>
    </HydrateClient>
  );
}
