# Plan 003: Establish a test baseline with Vitest (stats utils + stats router)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree** (the stats feature was untracked at that
> SHA). Compare the "Current state" excerpts below against the live files
> before starting; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (adds tests and config only; no production code changes)
- **Depends on**: plans/001-restore-lint-gate.md (gates), ideally after plans/002
- **Category**: tests
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The repo has **zero tests, no test runner, and no CI**. The only gate is
`tsc --noEmit`. The core of the product — the stats math in
`src/lib/utils/stats.ts` and the filter logic in
`src/lib/trpc/router/stats.ts` — is unverifiable, and plans 004–007 refactor
exactly that code. This plan creates the safety net those plans' done criteria
depend on: a one-command `pnpm test` with characterization tests for the
current behavior.

**Important**: two known bugs exist in the code under test (fixed by later
plans). Your tests must characterize CURRENT behavior of the pure functions and
the router — both of which are internally consistent in **epoch milliseconds**.
Do not "fix" anything you find; note it and move on.

## Current state

- No test files, no vitest/jest config, no `.github/` directory.
- `package.json` scripts: `dev`, `build`, `start`, `lint` (eslint after plan
  001), `typecheck` (after plan 001), `db:*` scripts. No `test` script.
- `tsconfig.json` maps `@/*` → `./src/*` — the vitest config must replicate
  this alias.
- Code under test:
  - `src/lib/utils/stats.ts` — four pure functions:
    - `toChartData(rounds, valueKey, dateFormat?)` — filters out rounds where
      `rounds[valueKey] === null`, maps to `{date, timestamp, value, label}`,
      sorts ascending by timestamp. Interprets `timestamp` as **epoch ms**
      (`new Date(r.timestamp)`).
    - `movingAverage(data, windowSize)` — returns `[]` when
      `data.length < windowSize`; otherwise returns `data.length - windowSize + 1`
      points, each the mean of the trailing window, rounded to 1 decimal.
    - `calculateAggregates(rounds)` — returns `null` for empty input; averages
      `score` over all rounds; averages `fairwayHitPct` / `girPct` / `putts`
      only over rounds where that field is non-null; returns `null` for a
      metric when no round has it.
    - `getPresetDateRange(preset)` — `'30d' | '90d' | '1y' | 'ytd' | 'all'`
      (unknown strings fall through to `'all'`, start = 2000-01-01); returns
      `{ start: Date, end: Date }` with `end` = now.
  - `src/lib/trpc/router/stats.ts` — `getRoundStats` (filters: `userId`
    required; `lastNRounds` 1–100 takes precedence over `startDate`/`endDate`;
    `excludeClubIds`; `holeCountFilter: 'all' | '9' | '18'`), `getClubs`
    (distinct clubs the user has rounds at, ordered by name), and
    `getSummaryStats` (a stub returning `null`; plan 008 deletes it — do not
    test it). `getRoundStats` returns rows ordered by `timestamp` DESC with
    derived fields `fairwayHitPct`, `girPct`, `puttsPerHole`, `puttsPerRound`
    (each `null` when its `*HoleCount` denominator is 0 or null).
- Test seams that already exist (do not create new ones):
  - `src/lib/trpc/index.ts` exports `createCaller` (bound to `appRouter`).
    Calling `createCaller({ db: testDb })` gives a typed server-side caller —
    procedures only use `ctx.db`.
  - `src/lib/db/index.ts` builds the db as
    `drizzle({ client: createClient({ url: process.env.DATABASE_URL! }) })`
    (libsql). An in-memory equivalent: `createClient({ url: ':memory:' })`.
  - Migrations live in `src/lib/db/migrations/` (two `.sql` files + meta);
    apply them in tests with `migrate` from `drizzle-orm/libsql/migrator`.
- Schema facts needed for fixtures (`src/lib/db/schema.ts`): `users` requires
  `id, name, age, email(unique)`; `clubs` requires `id, name`; `rounds`
  requires `id, userId, clubId, timestamp(int, epoch ms), score, strokes`;
  `roundHoles` PK is `(roundId, holeNumber)` with `strokes`; `roundStats` PK
  `roundId` with all stat columns nullable-with-default-0 (and
  `strokeGain*` default 100).
- Repo style: single quotes in `src/lib/**`, double quotes in some `src/app`
  files; 2-space indent. Match `src/lib/trpc/router/stats.ts` for the test
  files' import style.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Install   | `pnpm install`     | exit 0              |
| Add dep   | `pnpm add -D vitest` | exit 0            |
| Tests     | `pnpm test`        | all pass            |
| Typecheck | `pnpm typecheck`   | exit 0              |
| Lint      | `pnpm lint`        | exit 0              |

## Scope

**In scope**:
- `package.json` (add `test` / `test:watch` scripts, add `vitest` devDep)
- `vitest.config.ts` (create)
- `src/lib/utils/stats.test.ts` (create)
- `src/lib/trpc/router/stats.test.ts` (create)
- `src/lib/db/test-helpers.ts` (create — in-memory db factory)

**Out of scope**:
- Any change to production source files. Tests characterize what IS.
- Component/E2E testing (no jsdom, no Playwright) — deferred.
- CI workflow files — deferred (note in report if trivial to add later).
- Testing `userRouter` (plan 007 rewrites it; it will add its own tests).

## Git workflow

- Branch: `advisor/003-test-baseline`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install vitest and wire scripts

`pnpm add -D vitest`. Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts` in the repo root:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Verify**: `pnpm test` → "no test files found" (exit code may be non-zero;
that's expected at this step).

### Step 2: Unit tests for the pure stats utils

Create `src/lib/utils/stats.test.ts` covering, at minimum:

- `toChartData`: filters null-valued rounds; sorts ascending by timestamp even
  when input is DESC (the router returns DESC); formats `date` from an
  epoch-**ms** timestamp (e.g. `Date.UTC(2026, 0, 15)` → contains "Jan"); maps
  `clubName` → `label`.
- `movingAverage`: returns `[]` for input shorter than window; for
  `values [1,2,3,4], window 2` returns 3 points `[1.5, 2.5, 3.5]`; rounds to
  1 decimal; preserves the window-end point's `date`/`timestamp`.
- `calculateAggregates`: `[]` → `null`; averages `score` over all rounds;
  excludes null `fairwayHitPct`/`girPct`/`putts` rounds from their respective
  averages only; all-null metric → `null` for that metric while others compute.
- `getPresetDateRange`: `'30d'` start is ~30 days before now (assert within a
  minute of `Date.now() - 30*24*3600*1000`); `'ytd'` start is Jan 1 of the
  current year; unknown preset behaves like `'all'` (start year 2000).

Build fixture rounds with a small helper in the test file; only the fields the
function reads need real values, but type them as `RoundStatData` from
`@/lib/types/stats` (fill remaining fields with nulls/zeros).

**Verify**: `pnpm test` → stats.test.ts passes.

### Step 3: In-memory db helper

Create `src/lib/db/test-helpers.ts`:

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

export async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
  return db;
}
```

(Path is resolved from the repo root, where vitest runs.)

**Verify**: temporary smoke assertion in the next step's file, or run
`pnpm test` after Step 4.

### Step 4: Characterization tests for the stats router

Create `src/lib/trpc/router/stats.test.ts`. Setup per test file:

```ts
import { createCaller } from '@/lib/trpc';
import { createTestDb } from '@/lib/db/test-helpers';
import { users, clubs, rounds, roundStats, roundHoles } from '@/lib/db/schema';
```

`beforeEach`: fresh `createTestDb()`, then insert fixtures: two users, two
clubs, and ~5 rounds for user A (varying timestamps in **epoch ms**, one round
belonging to user B, one 9-hole round with 9 `roundHoles` rows, one 18-hole
round with 18 rows, each round with a `roundStats` row). Build the caller:
`const caller = createCaller({ db } as never)` — if the context type rejects
the test db, cast the ctx argument (`as never` / `as Parameters<typeof createCaller>[0]`)
rather than changing production types.

Cases, at minimum:

1. **userId scoping**: user A's query never returns user B's round.
2. **ordering**: results are timestamp DESC.
3. **lastNRounds**: limit respected and takes the N most recent; also verify
   it takes precedence — pass `lastNRounds: 2` together with a `startDate` in
   the far future and confirm 2 rounds still return (date range ignored).
4. **date range**: `startDate`/`endDate` in epoch ms include/exclude the right
   rounds (boundaries inclusive: `gte`/`lte`).
5. **excludeClubIds**: excluding club 1 removes its rounds.
6. **holeCountFilter**: `'9'` returns only the 9-hole round, `'18'` only the
   18-hole one, `'all'`/omitted returns everything; a filter matching nothing
   returns `[]`.
7. **derived metrics**: a round with `fairwayMiddles: 7, fairwayHoleCount: 14`
   → `fairwayHitPct` 50; a round with `fairwayHoleCount: 0` → `fairwayHitPct`
   null; `puttsPerRound` = `putts / puttHoleCount * 18`.
8. **getClubs**: returns only clubs where the user has rounds, distinct,
   ordered by name.

**Verify**: `pnpm test` → all files pass.

### Step 5: Full gate

**Verify**: `pnpm test` → exit 0; `pnpm typecheck` → exit 0; `pnpm lint` →
exit 0.

## Test plan

This plan IS the test plan. Expected end state: ~2 test files, ≥18 assertions
total, `pnpm test` green in under ~15 seconds.

## Done criteria

- [ ] `pnpm test` exits 0 with both new test files passing
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `git status` shows no modified production source files (only the 5
      in-scope files created/modified)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `migrate()` fails against the in-memory libsql client (migration SQL may
  contain statements the memory backend rejects) — report the exact error; a
  fallback (executing the `.sql` files manually, as `src/lib/db/reset.ts` does)
  exists but a human should choose it.
- The router behavior contradicts a case above (e.g. boundaries are exclusive)
  — that's a real finding; characterize the ACTUAL behavior in the test, and
  flag the discrepancy in your report instead of changing production code.
- You need to modify any production file to make code testable.

## Maintenance notes

- Plans 004, 005, 006, 007 modify code covered here and must UPDATE these
  characterization tests to the new intended behavior — that's expected; the
  point is the change is visible in a diff.
- When a CI pipeline is added, run `pnpm lint && pnpm typecheck && pnpm test`.
- `getSummaryStats` is intentionally untested — plan 008 deletes it.
