import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server';
import { Suspense } from 'react';
import UserList from '@components/user/user-list';

export default function Home() {
  prefetch(trpc.user.all.queryOptions());

  return (
    <HydrateClient>
      <main className='w-full flex h-screen flex-col items-center py-24 space-y-8'>
        <div className='flex flex-col items-center justify-center space-y-8'>
          <h1 className='text-5xl font-extrabold tracking-tight sm:text-[5rem]'>
            Antho MVP
          </h1>

          <div className='w-full overflow-y-scroll space-y-4'>
            <Suspense
              fallback={
                <div className='flex w-full flex-col gap-4'>
                  <p>Loading...</p>
                </div>
              }
            >
              <h2 className='text-2xl font-bold'>Users</h2>
              <UserList />
            </Suspense>
          </div>
        </div>
        <div className='w-full max-w-2xl overflow-y-scroll space-y-2'>
          {/* <CreateChallengeForm /> */}
        </div>
      </main>
    </HydrateClient>
  );
}
