import { Suspense } from 'react';
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server';
import { DEFAULT_USER_ID } from '@/lib/user';
import { RoundForm } from './_components/round-form';

export default async function NewRoundPage() {
  prefetch(trpc.courses.list.queryOptions({ userId: DEFAULT_USER_ID }));

  return (
    <HydrateClient>
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New round</h1>
            <p className="text-muted-foreground">
              Strokes per Hole; Par comes from the Course and can be edited
            </p>
          </div>

          <Suspense
            fallback={<div className="text-muted-foreground">Loading courses...</div>}
          >
            <RoundForm userId={DEFAULT_USER_ID} />
          </Suspense>
        </div>
      </main>
    </HydrateClient>
  );
}
