import { describe, it, expect, beforeEach } from 'vitest';
import { createCaller } from '@/lib/trpc';
import { createTestDb } from '@/lib/db/test-helpers';
import { users, clubs, rounds } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const withRounds = { id: 'with-rounds', name: 'Has Rounds', age: 30, email: 'rounds@test.dev' };
const noRounds = { id: 'no-rounds', name: 'No Rounds', age: 40, email: 'none@test.dev' };

let db: TestDb;
let caller: ReturnType<typeof createCaller>;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([withRounds, noRounds]);
  await db.insert(clubs).values({ id: 'c1', name: 'Hancock' });
  await db.insert(rounds).values({ id: 'r1', userId: withRounds.id, clubId: 'c1', timestamp: 1, score: 0, strokes: 35 });
  caller = createCaller({ db });
});

const userIds = async () => (await db.select({ id: users.id }).from(users)).map((u) => u.id).sort();

describe('user.delete', () => {
  it('refuses to delete a user who has Rounds, with a conflict error, orphaning nothing', async () => {
    await expect(caller.user.delete({ id: withRounds.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await userIds()).toEqual(['no-rounds', 'with-rounds']);
    expect(await db.select({ id: rounds.id }).from(rounds)).toEqual([{ id: 'r1' }]);
  });

  it('deletes a user who has no Rounds', async () => {
    await caller.user.delete({ id: noRounds.id });
    expect(await userIds()).toEqual(['with-rounds']);
  });
});

describe('user.update', () => {
  it('rejects an update without an id at validation', async () => {
    // @ts-expect-error id is required
    await expect(caller.user.update({ name: 'Nobody' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('changes the given fields and leaves the rest intact', async () => {
    await caller.user.update({ id: noRounds.id, name: 'Renamed' });
    const [row] = await db.select().from(users).where(eq(users.id, noRounds.id));
    expect(row).toEqual({ ...noRounds, name: 'Renamed' });
  });
});
