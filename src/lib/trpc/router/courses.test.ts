import { describe, it, expect, beforeEach } from 'vitest';
import { createCaller } from '@/lib/trpc';
import { createTestDb } from '@/lib/db/test-helpers';
import { users, clubs, courseHoles, rounds, roundHoles } from '@/lib/db/schema';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

// Hancock is a 9-hole Course.
const HANCOCK = '8ae88a70-86ac-11e4-8c28-020000005b00';
const HANCOCK_PARS = [4, 4, 4, 4, 3, 5, 4, 3, 4];

const played = (roundId: string, strokes: number[], pars: (number | null)[]) =>
  strokes.map((s, i) => ({ roundId, holeNumber: i + 1, strokes: s, par: pars[i] }));

let caller: ReturnType<typeof createCaller>;

beforeEach(async () => {
  const db: TestDb = await createTestDb();
  await db.insert(users).values([
    { id: 'a', name: 'A', age: 30, email: 'a@test.dev' },
    { id: 'b', name: 'B', age: 30, email: 'b@test.dev' },
  ]);
  await db.insert(clubs).values([{ id: HANCOCK, name: 'Hancock Golf Course' }]);
  await db.insert(courseHoles).values(HANCOCK_PARS.map((par, i) => ({ clubId: HANCOCK, holeNumber: i + 1, par })));
  await db.insert(rounds).values([
    { id: 'nine', userId: 'a', clubId: HANCOCK, timestamp: 1, score: 0, strokes: 35 },
    { id: 'eighteen', userId: 'a', clubId: HANCOCK, timestamp: 2, score: 0, strokes: 70 },
    { id: 'other-user', userId: 'b', clubId: HANCOCK, timestamp: 3, score: 0, strokes: 35 },
  ]);
  await db.insert(roundHoles).values([
    // Pars every Hole except a birdie on #9.
    ...played('nine', [4, 4, 4, 4, 3, 5, 4, 3, 3], HANCOCK_PARS),
    // Bogeys everywhere except a birdie on Played Hole 17 (= Hole 8).
    ...played('eighteen', [5, 5, 5, 5, 4, 6, 5, 4, 5, 5, 5, 5, 5, 4, 6, 5, 2, 5], [...HANCOCK_PARS, ...HANCOCK_PARS]),
    // Another user's eagle on #1 must not show up.
    ...played('other-user', [2, 4, 4, 4, 3, 5, 4, 3, 4], HANCOCK_PARS),
  ]);
  caller = createCaller({ db });
});

describe('courses.holeResults', () => {
  it("summarizes a 9-hole Course's Holes for one user, folding 18-hole Rounds", async () => {
    const result = await caller.courses.holeResults({ userId: 'a', clubId: HANCOCK });

    expect(result.name).toBe('Hancock Golf Course');
    expect(result.holes).toHaveLength(9);
    expect(result.holes[0]).toMatchObject({ hole: 1, timesPlayed: 3, parCount: 1, eagleOrBetter: 0, best: 'par' });
    expect(result.holes[7]).toMatchObject({ hole: 8, parsPlayed: [3], timesPlayed: 3, birdies: 1, best: 'birdie' });
    expect(result.progress).toEqual({ parOrBetter: 9, birdied: 2, total: 9 });
  });
});
