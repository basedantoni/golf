import { describe, it, expect, beforeEach } from 'vitest';
import { createCaller } from '@/lib/trpc';
import { createTestDb } from '@/lib/db/test-helpers';
import { eq } from 'drizzle-orm';
import { users, clubs, rounds, roundStats, roundHoles } from '@/lib/db/schema';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const day = (d: number) => Date.UTC(2026, 0, d);

const USER_A = 'user-a';
const USER_B = 'user-b';
const userA = { id: USER_A, name: 'A', age: 30, email: 'a@test.dev' };

function holes(roundId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    roundId,
    holeNumber: i + 1,
    strokes: 4,
  }));
}

// User A: r1..r5 on Jan 1/5/10/20/30. r1 is 18 holes, r2 is 9 holes, the rest
// have no hole rows. r4 has null hole-count denominators. User B: rb on Jan 25, 9 holes, at a club A never played.
async function seed(db: TestDb) {
  await db.insert(users).values([
    userA,
    { id: USER_B, name: 'B', age: 40, email: 'b@test.dev' },
  ]);
  await db.insert(clubs).values([
    { id: 'c1', name: 'Zebra Links' },
    { id: 'c2', name: 'Augusta' },
    { id: 'c3', name: 'Only B Plays Here' },
  ]);
  await db.insert(rounds).values([
    { id: 'r1', userId: USER_A, clubId: 'c1', timestamp: day(1), score: 2, strokes: 74 },
    { id: 'r2', userId: USER_A, clubId: 'c2', timestamp: day(5), score: 1, strokes: 37 },
    { id: 'r3', userId: USER_A, clubId: 'c1', timestamp: day(10), score: 0, strokes: 72 },
    { id: 'r4', userId: USER_A, clubId: 'c2', timestamp: day(20), score: 3, strokes: 75 },
    { id: 'r5', userId: USER_A, clubId: 'c1', timestamp: day(30), score: -1, strokes: 71 },
    { id: 'rb', userId: USER_B, clubId: 'c3', timestamp: day(25), score: 5, strokes: 41 },
  ]);
  await db.insert(roundStats).values([
    {
      roundId: 'r1',
      fairwayMiddles: 7,
      fairwayHoleCount: 14,
      gir: 9,
      girHoleCount: 18,
      putts: 36,
      puttHoleCount: 18,
    },
    {
      roundId: 'r2',
      fairwayMiddles: 3,
      fairwayHoleCount: 0,
      gir: 2,
      girHoleCount: 0,
      putts: 16,
      puttHoleCount: 0,
    },
    { roundId: 'r3', putts: 15, puttHoleCount: 9 },
    { roundId: 'r4', fairwayHoleCount: null, girHoleCount: null, puttHoleCount: null },
    { roundId: 'r5' },
    { roundId: 'rb' },
  ]);
  await db.insert(roundHoles).values([...holes('r1', 18), ...holes('r2', 9), ...holes('rb', 9)]);
}

let db: TestDb;
let caller: ReturnType<typeof createCaller>;

beforeEach(async () => {
  db = await createTestDb();
  await seed(db);
  caller = createCaller({ db });
});

const ids = (rows: { roundId: string }[]) => rows.map((r) => r.roundId);

describe('stats.getRoundStats', () => {
  it("returns only the requested user's rounds, newest first", async () => {
    expect(ids(await caller.stats.getRoundStats({ userId: USER_A }))).toEqual([
      'r5',
      'r4',
      'r3',
      'r2',
      'r1',
    ]);
    expect(ids(await caller.stats.getRoundStats({ userId: USER_B }))).toEqual(['rb']);
  });

  it('includes club name and round fields', async () => {
    const [r5] = await caller.stats.getRoundStats({ userId: USER_A, lastNRounds: 1 });
    expect(r5).toMatchObject({
      roundId: 'r5',
      timestamp: day(30),
      score: -1,
      strokes: 71,
      clubId: 'c1',
      clubName: 'Zebra Links',
    });
  });

  describe('lastNRounds', () => {
    it('returns the N most recent rounds', async () => {
      expect(ids(await caller.stats.getRoundStats({ userId: USER_A, lastNRounds: 2 }))).toEqual([
        'r5',
        'r4',
      ]);
    });

    it('takes precedence over the date range', async () => {
      const rows = await caller.stats.getRoundStats({
        userId: USER_A,
        lastNRounds: 2,
        startDate: day(1000),
        endDate: day(1001),
      });
      expect(ids(rows)).toEqual(['r5', 'r4']);
    });

    it.each([0, 101])('rejects %i', async (lastNRounds) => {
      await expect(
        caller.stats.getRoundStats({ userId: USER_A, lastNRounds }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  describe('date range (epoch ms)', () => {
    it('includes rounds on both boundaries', async () => {
      const rows = await caller.stats.getRoundStats({
        userId: USER_A,
        startDate: day(5),
        endDate: day(20),
      });
      expect(ids(rows)).toEqual(['r4', 'r3', 'r2']);
    });

    it('excludes rounds just outside the boundaries', async () => {
      const rows = await caller.stats.getRoundStats({
        userId: USER_A,
        startDate: day(5) + 1,
        endDate: day(20) - 1,
      });
      expect(ids(rows)).toEqual(['r3']);
    });

    it('applies startDate alone and endDate alone', async () => {
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, startDate: day(20) })),
      ).toEqual(['r5', 'r4']);
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, endDate: day(5) })),
      ).toEqual(['r2', 'r1']);
    });
  });

  it('excludes rounds at the given clubs', async () => {
    const rows = await caller.stats.getRoundStats({ userId: USER_A, excludeClubIds: ['c1'] });
    expect(ids(rows)).toEqual(['r4', 'r2']);
  });

  describe('holeCountFilter', () => {
    it("'9' returns only the user's 9-hole rounds", async () => {
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, holeCountFilter: '9' })),
      ).toEqual(['r2']);
    });

    it("'18' returns only 18-hole rounds", async () => {
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, holeCountFilter: '18' })),
      ).toEqual(['r1']);
    });

    it("'all' and omitted return every round", async () => {
      const every = ['r5', 'r4', 'r3', 'r2', 'r1'];
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, holeCountFilter: 'all' })),
      ).toEqual(every);
      expect(ids(await caller.stats.getRoundStats({ userId: USER_A }))).toEqual(every);
    });

    it('returns [] when the user has no round with that hole count', async () => {
      expect(await caller.stats.getRoundStats({ userId: USER_B, holeCountFilter: '18' })).toEqual(
        [],
      );
    });

    it('returns [] when no round in the database has that hole count', async () => {
      const db = await createTestDb();
      await db.insert(users).values(userA);
      const empty = createCaller({ db });
      expect(await empty.stats.getRoundStats({ userId: USER_A, holeCountFilter: '18' })).toEqual(
        [],
      );
    });
  });

  describe('fullyLoggedOnly', () => {
    // r1 (18 holes, 14 fairway holes) with a result logged on every hole.
    const fullyLogged = {
      fairwayMiddles: 7,
      fairwayLefts: 4,
      fairwayRights: 3,
      gir: 9,
      girShorts: 9,
      putts: 36,
    };

    async function setR1(stats: Partial<typeof roundStats.$inferInsert>) {
      await db.update(roundStats).set(stats).where(eq(roundStats.roundId, 'r1'));
    }

    it('returns only rounds with fairways, GIR and putts logged on every hole', async () => {
      await setR1(fullyLogged);
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, fullyLoggedOnly: true })),
      ).toEqual(['r1']);
    });

    it.each([
      ['a fairway result is missing', { fairwayLefts: 3 }],
      ['no fairway holes were tracked', { fairwayMiddles: 0, fairwayLefts: 0, fairwayRights: 0, fairwayHoleCount: 0 }],
      ['a GIR result is missing', { girShorts: 8 }],
      ['GIR covers fewer holes than the round', { girShorts: 8, girHoleCount: 17 }],
      ['putts are fewer than holes', { putts: 17 }],
    ])('excludes a round when %s', async (_, broken) => {
      await setR1({ ...fullyLogged, ...broken });
      expect(await caller.stats.getRoundStats({ userId: USER_A, fullyLoggedOnly: true })).toEqual(
        [],
      );
    });

    it('applies lastNRounds after filtering', async () => {
      await setR1(fullyLogged);
      expect(
        ids(
          await caller.stats.getRoundStats({ userId: USER_A, fullyLoggedOnly: true, lastNRounds: 1 }),
        ),
      ).toEqual(['r1']);
    });

    it('returns every round when false', async () => {
      expect(
        ids(await caller.stats.getRoundStats({ userId: USER_A, fullyLoggedOnly: false })),
      ).toEqual(['r5', 'r4', 'r3', 'r2', 'r1']);
    });
  });

  describe('derived metrics', () => {
    async function byId(roundId: string) {
      const rows = await caller.stats.getRoundStats({ userId: USER_A });
      return rows.find((r) => r.roundId === roundId)!;
    }

    it('computes percentages and putts from raw stats', async () => {
      expect(await byId('r1')).toMatchObject({
        fairwayHitPct: 50,
        girPct: 50,
        puttsPerHole: 2,
        puttsPerRound: 36,
      });
    });

    it('normalizes putts per round to 18 holes', async () => {
      const r3 = await byId('r3');
      expect(r3.puttsPerRound).toBe(30);
      expect(r3.puttsPerHole).toBeCloseTo(1.667, 3);
    });

    it.each([
      ['0', 'r2'],
      ['null', 'r4'],
    ])('returns null metrics when the hole-count denominator is %s', async (_, roundId) => {
      expect(await byId(roundId)).toMatchObject({
        fairwayHitPct: null,
        girPct: null,
        puttsPerHole: null,
        puttsPerRound: null,
      });
    });
  });
});

describe('stats.getClubs', () => {
  it('returns distinct clubs the user has played, ordered by name', async () => {
    expect(await caller.stats.getClubs({ userId: USER_A })).toEqual([
      { id: 'c2', name: 'Augusta' },
      { id: 'c1', name: 'Zebra Links' },
    ]);
  });

  it('returns [] for a user with no rounds', async () => {
    expect(await caller.stats.getClubs({ userId: 'nobody' })).toEqual([]);
  });
});
