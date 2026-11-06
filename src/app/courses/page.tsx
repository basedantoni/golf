import { Suspense } from 'react';
import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server';
import { CourseHoles } from './_components/course-holes';

// For now, hardcode user ID - this would come from auth in real app
const DEFAULT_USER_ID = '5a4221d0-82cf-11f0-ac33-021d58ec5439';

export default async function CoursesPage() {
  prefetch(trpc.courses.list.queryOptions({ userId: DEFAULT_USER_ID }));

  return (
    <HydrateClient>
      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
            <p className="text-muted-foreground">
              Every Hole you&apos;ve made par or better on, per Course
            </p>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Loading courses...</div>
              </div>
            }
          >
            <CourseHoles userId={DEFAULT_USER_ID} />
          </Suspense>
        </div>
      </main>
    </HydrateClient>
  );
}
