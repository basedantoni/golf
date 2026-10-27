# Plan 006: Use normalized putts-per-round in the chart and summary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree**. Plan 004 rewrites the `queryInput`
> memo in `stats-dashboard.tsx` and the top of `utils/stats.ts` — expected
> drift; the excerpts below for the putts chart and `calculateAggregates` must
> still match. On other mismatches, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-test-baseline-vitest.md, plans/004-fix-date-range-filter.md (same files; run sequentially)
- **Category**: bug
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

**75 of the 95 seeded rounds are 9-hole rounds** (verified from `data.json`),
but the "Putts per Round" chart and the "Putts/Round" summary stat use the
**raw putt count** per round. A 9-hole round shows ~15 putts against the
chart's "Target: 32" reference line, and the summary average blends 9- and
18-hole rounds into a meaningless number. The server already computes the
right value — `puttsPerRound` (putts normalized to 18 holes:
`putts / puttHoleCount * 18`) — and the client type already declares it; the
UI just never uses it.

## Current state

- `src/lib/trpc/router/stats.ts:140-143` — server computes the normalized value:
  ```ts
  // Putts per round (normalized to 18 holes)
  puttsPerRound: row.puttHoleCount
    ? ((row.putts ?? 0) / row.puttHoleCount) * 18
    : null,
  ```
- `src/lib/types/stats.ts:13` — `puttsPerRound: number | null;` exists on
  `RoundStatData` but is referenced nowhere in the UI.
- `src/app/stats/_components/stats-dashboard.tsx:94-98` — chart uses raw putts:
  ```ts
  const puttsChartData = useMemo(
    () => toChartData(roundStats, "putts"),
    [roundStats],
  );
  console.log("Putts Chart Data", puttsChartData);
  ```
  (The `console.log` is deleted by plan 008; if it's already gone, fine.)
- `src/lib/utils/stats.ts:41,56-60` — summary aggregate uses raw putts:
  ```ts
  const validPutts = rounds.filter((r) => r.putts !== null);
  ...
  avgPuttsPerRound:
    validPutts.length > 0
      ? validPutts.reduce((sum, r) => sum + (r.putts ?? 0), 0) /
        validPutts.length
      : null,
  ```
- The chart card (`stats-dashboard.tsx:190-196`) is titled "Putts per Round"
  with `targetValue={32}` — 32 putts is a standard 18-hole benchmark, so the
  normalized value is what the target line assumes.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Tests     | `pnpm test`      | all pass            |
| Typecheck | `pnpm typecheck` | exit 0              |
| Lint      | `pnpm lint`      | exit 0              |

## Scope

**In scope**:
- `src/app/stats/_components/stats-dashboard.tsx` (putts chart data source)
- `src/lib/utils/stats.ts` (`calculateAggregates` putts branch)
- `src/lib/utils/stats.test.ts` (update expectations)

**Out of scope**:
- The server-side calculation in `router/stats.ts` — already correct.
- `puttsPerHole` — computed and unused; leave it (cheap, may serve plan 011).
- Chart component internals, titles, targets.

## Git workflow

- Branch: `advisor/006-normalize-putts-metrics`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Point the chart at the normalized field

In `stats-dashboard.tsx`, change:

```ts
() => toChartData(roundStats, "putts"),
```

to:

```ts
() => toChartData(roundStats, "puttsPerRound"),
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Fix the summary aggregate

In `src/lib/utils/stats.ts`, `calculateAggregates`, replace the putts branch:

```ts
const validPutts = rounds.filter((r) => r.puttsPerRound !== null);
```

and:

```ts
avgPuttsPerRound:
  validPutts.length > 0
    ? validPutts.reduce((sum, r) => sum + (r.puttsPerRound ?? 0), 0) /
      validPutts.length
    : null,
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Update tests

In `src/lib/utils/stats.test.ts`, update the `calculateAggregates` cases so
fixtures set `puttsPerRound` (not `putts`) and assert the average over it.
Add one regression case: two rounds, a 9-hole with `putts: 15,
puttsPerRound: 30` and an 18-hole with `putts: 32, puttsPerRound: 32` →
`avgPuttsPerRound` is **31** (not 23.5, which is what the raw-putts bug
produced).

**Verify**: `pnpm test` → all pass.

### Step 4: Manual smoke

`pnpm dev` → `http://localhost:3000/stats`. With the default filters (last 20
rounds, mostly 9-hole data), the "Putts per Round" chart should now cluster
around ~30–36, near the target-32 line, instead of half the chart sitting
around ~15.

**Verify**: visually, no points at ~15 unless a round genuinely putted that
badly per 18.

## Test plan

Covered in Step 3; the 31-vs-23.5 case is the named regression test.

## Done criteria

- [ ] `pnpm test` exits 0 including the new regression case
- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] `grep -n 'toChartData(roundStats, "putts")' src/app/stats/_components/stats-dashboard.tsx` → no matches
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `puttsPerRound` is missing from `RoundStatData` or the router response
  (drift — someone removed it).
- The manual smoke still shows a bimodal ~15/~32 split — the 9-hole rounds may
  have `puttHoleCount` of 18 in the seed data, which would be a data bug to
  report, not code to change.

## Maintenance notes

- Same normalization question applies to any future per-round counting stat
  (penalties, up-and-downs): store raw + hole count, normalize at display.
- The "Score Trend" chart still plots raw `score` mixing 9/18-hole rounds —
  same class of issue, deferred deliberately: score semantics need the par
  data investigation in plan 009 before normalizing.
