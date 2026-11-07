import { describe, it, expect, beforeEach } from 'vitest';
import { createCaller } from '@/lib/trpc';
import { createTestDb } from '@/lib/db/test-helpers';
import { users, clubs, courseHoles } from '@/lib/db/schema';
import { count } from 'drizzle-orm';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const HANCOCK = 'hancock';
const HANCOCK_PARS = [4, 4, 4, 4, 3, 5, 4, 3, 4];

let db: TestDb;
let caller: ReturnType<typeof createCaller>;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'a', name: 'A', age: 30, email: 'a@test.dev' });
  await db.insert(clubs).values([{ id: HANCOCK, name: 'Hancock Golf Course' }]);
  await db.insert(courseHoles).values(HANCOCK_PARS.map((par, i) => ({ clubId: HANCOCK, holeNumber: i + 1, par })));
  caller = createCaller({ db });
});

describe('courses.usualPars', () => {
  it("gives each Hole's Usual Par in hole order", async () => {
    expect(await caller.courses.usualPars({ clubId: HANCOCK })).toEqual(HANCOCK_PARS);
  });
});

// Played Holes from strokes and pars, no detail logged unless given.
const entered = (strokes: number[], pars: number[], start = 1) =>
  strokes.map((s, i) => ({ holeNumber: start + i, par: pars[i], strokes: s, putts: null, fairway: null, gir: null }));

describe('rounds.create', () => {
  it('derives strokes, score and Result counts from the Played Holes', async () => {
    const holes = entered([4, 4, 4, 4, 3, 5, 4, 3, 3], HANCOCK_PARS).map((h) => ({
      ...h,
      putts: 2,
      fairway: h.par === 3 ? null : ('hit' as const),
      gir: 'hit' as const,
    }));
    const { id } = await caller.rounds.create({ userId: 'a', club: { id: HANCOCK }, timestamp: 1000, holes });

    const [round] = await caller.stats.getRoundStats({ userId: 'a', fullyLoggedOnly: true });
    expect(round).toMatchObject({
      roundId: id,
      clubName: 'Hancock Golf Course',
      strokes: 34,
      score: -1,
      birdies: 1,
      pars: 8,
      fairwayHitPct: 100,
      puttsPerRound: 36,
      strokeGainOverall: null,
    });
  });

  it("creates a new Club's Course and takes its Usual Pars from the first Round, folding an 18-hole Round onto 9 Holes", async () => {
    const pars = [4, 3, 5, 4, 4, 3, 4, 5, 4];
    // Second loop plays Hole 2 from a tee that makes it a par 4; the first loop sets the Usual Par.
    const holes = entered(Array(18).fill(4), [...pars, 4, 4, ...pars.slice(2)]);
    await caller.rounds.create({ userId: 'a', club: { name: 'Muny', holeCount: 9 }, timestamp: 1000, holes });

    const [course] = await caller.courses.list({ userId: 'a' });
    expect(course).toMatchObject({ name: 'Muny', rounds: 1 });
    expect(await caller.courses.usualPars({ clubId: course.id })).toEqual(pars);

    const results = await caller.courses.holeResults({ userId: 'a', clubId: course.id });
    expect(results.holes).toHaveLength(9);
    expect(results.holes[1]).toMatchObject({ hole: 2, parsPlayed: [3, 4], timesPlayed: 2, parCount: 1 });
  });

  it('stores a back nine as Played Holes 10-18, keeping Usual Pars already known', async () => {
    const eighteen = 'eighteen';
    await db.insert(clubs).values({ id: eighteen, name: 'Eighteen' });
    const usual = [...HANCOCK_PARS, ...HANCOCK_PARS];
    await db.insert(courseHoles).values(usual.map((par, i) => ({ clubId: eighteen, holeNumber: i + 1, par })));

    // Played the back nine with Hole 10 as a par 5 from the tips.
    const holes = entered(HANCOCK_PARS, [5, ...HANCOCK_PARS.slice(1)], 10);
    await caller.rounds.create({ userId: 'a', club: { id: eighteen }, timestamp: 1000, holes });

    expect(await caller.courses.usualPars({ clubId: eighteen })).toEqual(usual);
    const results = await caller.courses.holeResults({ userId: 'a', clubId: eighteen });
    expect(results.holes[0]).toMatchObject({ hole: 1, timesPlayed: 0 });
    expect(results.holes[9]).toMatchObject({ hole: 10, parsPlayed: [5], birdies: 1 });
  });

  it.each([
    ['10 Played Holes', entered(Array(10).fill(4), Array(10).fill(4))],
    ['a nine starting on Played Hole 2', entered(HANCOCK_PARS, HANCOCK_PARS, 2)],
    ['an 18 starting on Played Hole 10', entered(Array(18).fill(4), Array(18).fill(4), 10)],
    ['a repeated Played Hole', entered(HANCOCK_PARS, HANCOCK_PARS).map((h, i) => (i === 8 ? { ...h, holeNumber: 1 } : h))],
    ['a Round in the future', entered(HANCOCK_PARS, HANCOCK_PARS), Date.now() + 2 * 86_400_000],
    ['a missing Par', entered(HANCOCK_PARS, [...HANCOCK_PARS.slice(0, 8), null as unknown as number])],
  ])('rejects %s', async (_, holes, timestamp = 1000) => {
    await expect(caller.rounds.create({ userId: 'a', club: { id: HANCOCK }, timestamp, holes })).rejects.toThrow();
  });

  it('writes nothing when any insert fails', async () => {
    const holes = entered(HANCOCK_PARS, HANCOCK_PARS);
    // The new Club inserts first; the Round then fails its user foreign key.
    await expect(
      caller.rounds.create({ userId: 'nobody', club: { name: 'Ghost', holeCount: 9 }, timestamp: 1000, holes }),
    ).rejects.toThrow();

    const rows = async (table: typeof clubs | typeof courseHoles) => (await db.select({ n: count() }).from(table))[0].n;
    expect(await rows(clubs)).toBe(1);
    expect(await rows(courseHoles)).toBe(HANCOCK_PARS.length);
  });
});
