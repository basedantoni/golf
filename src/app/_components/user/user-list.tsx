'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { useTRPC } from '@/lib/trpc/react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';

export default function UserList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: users } = useSuspenseQuery(trpc.user.all.queryOptions());

  const { mutate: updateUser } = useMutation(
    trpc.user.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.user.pathFilter()),
    })
  );

  const { mutate: deleteUser } = useMutation(
    trpc.user.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.user.pathFilter()),
    })
  );

  if (users.length === 0) {
    return <div>No users</div>;
  }

  return (
    <ScrollArea className='h-96 max-w-lg rounded-md border'>
      <div className='p-4'>
        {users.map((user) => (
          <div key={user.id}>
            <div className='text-sm flex items-center justify-between'>
              <p>{user.name}</p>
              <div className='flex items-center gap-2'>
                <Button
                  className='cursor-pointer'
                  variant='destructive'
                  size='sm'
                  onClick={() => deleteUser({ id: user.id })}
                >
                  Delete
                </Button>
              </div>
            </div>
            <Separator className='my-2' />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
