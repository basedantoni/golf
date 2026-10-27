# Plan 004: Fix the broken date-range filter (ms/seconds mismatch + preset state)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree**. Note plan 001 may already have
> converted the `require()` in `stats-filters.tsx` to a top-level import —
> that is expected drift, not a STOP. Compare all other "Current state"
> excerpts against the live files; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-test-baseline-vitest.md
- **Category**: bug
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The stats dashboard's "date range" filter mode is completely broken. Round
timestamps are stored as **epoch milliseconds** (e.g. `1756577764201` — see
`data.json` and `rounds.timestamp`), but the dashboard converts the selected
dates to **epoch seconds** before sending them to the API. An `endDate` in
seconds is smaller than every ms timestamp, so `lte(rounds.timestamp, endDate)`
filters out **all rounds** — every date preset renders an empty dashboard.
Two adjacent defects in the same flow: the preset `<Select>` never displays
the chosen preset (its value is computed as `'custom'`, which isn't an option),
and the preset-to-dates conversion uses a runtime `require()` inside a
client-component callback.

## Current state

- `src/app/stats/_components/stats-dashboard.tsx:50-59` — the unit bug:
  ```ts
  if (filters.mode === "lastN") {
    input.lastNRounds = filters.lastNRounds;
  } else {
    if (filters.startDate) {
      input.startDate = Math.floor(filters.startDate.getTime() / 1000);
    }
    if (filters.endDate) {
      input.endDate = Math.floor(filters.endDate.getTime() / 1000);
    }
  }
  ```
- `src/app/stats/_components/stats-filters.tsx:46-62` — preset display + require:
  ```tsx
  <DateRangeFilter
    value={
      filters.startDate && filters.endDate
        ? 'custom'
        : 'all'
    }
    onChange={(preset) => {
      // Convert preset to dates using utility
      const { getPresetDateRange } = require('@/lib/utils/stats');
      const { start, end } = getPresetDateRange(preset);
      ...
  ```
  (`'custom'` is not in `DATE_PRESETS` in `date-range-filter.tsx`, so the
  Select shows blank after any selection.)
- `src/lib/types/stats.ts:26-33` — `FilterState` has `startDate/endDate:
  Date | null` but no field remembering which preset was chosen.
- `src/lib/trpc/router/stats.ts:8-20` — `statsFilterSchema`; the comment on
  line 9 says "Unix timestamps" (misleading; the DB stores ms).
- `src/app/stats/_components/date-range-filter.tsx` — dumb Select over
  `DATE_PRESETS` (`30d`, `90d`, `ytd`, `1y`, `all`); no changes needed here.
- `src/lib/utils/stats.ts:65-90` — `getPresetDateRange(preset)` returns
  `{ start: Date, end: Date }`.
- Initial filter state (`stats-dashboard.tsx:25-32`) has no `datePreset` field.
- Conventions: client components with `'use client'`; hooks + `useMemo` for
  derived state; single-quote imports in `_components` except
  `stats-dashboard.tsx` which uses double quotes — match each file's existing
  style.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Typecheck | `pnpm typecheck` | exit 0              |
| Tests     | `pnpm test`      | all pass            |
| Lint      | `pnpm lint`      | exit 0              |
| Manual    | `pnpm dev` then open http://localhost:3000/stats | dashboard renders |

## Scope

**In scope**:
- `src/app/stats/_components/stats-dashboard.tsx`
- `src/app/stats/_components/stats-filters.tsx`
- `src/lib/types/stats.ts`
- `src/lib/utils/stats.ts` (add one pure function)
- `src/lib/utils/stats.test.ts` (extend)
- `src/lib/trpc/router/stats.ts` — **comment on line 9 only**

## Out of scope:
- `src/app/stats/_components/date-range-filter.tsx` — works as-is.
- Router logic, schema, any server code beyond the one comment.
- Custom (calendar-picked) date ranges — presets only; note as follow-up.

## Git workflow

- Branch: `advisor/004-fix-date-range-filter`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `datePreset` to FilterState

In `src/lib/types/stats.ts`, extend `FilterState`:

```ts
export type DatePreset = '30d' | '90d' | 'ytd' | '1y' | 'all';

export interface FilterState {
  mode: 'lastN' | 'dateRange';
  lastNRounds: number;
  datePreset: DatePreset;
  startDate: Date | null;
  endDate: Date | null;
  excludeClubIds: string[];
  holeCountFilter: 'all' | '9' | '18';
}
```

In `stats-dashboard.tsx`, add `datePreset: "all"` to the initial
`useState<FilterState>` object.

**Verify**: `pnpm typecheck` → exit 0 (after Step 2 completes; typecheck will
transiently flag `stats-filters.tsx` until then — fine to run at end of Step 2).

### Step 2: Fix the filters component

In `src/app/stats/_components/stats-filters.tsx`:

1. Ensure a top-level import exists:
   `import { getPresetDateRange } from '@/lib/utils/stats';`
   and delete the inline `require(...)` line (if plan 001 already did this,
   keep its version).
2. Replace the `DateRangeFilter` props:
   ```tsx
   <DateRangeFilter
     value={filters.datePreset}
     onChange={(preset) => {
       const { start, end } = getPresetDateRange(preset);
       onFilterChange({
         ...filters,
         datePreset: preset as DatePreset,
         startDate: start,
         endDate: end,
       });
     }}
   />
   ```
   (Import `DatePreset` from `@/lib/types/stats`.)

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 3: Extract a pure, testable query-input builder with ms units

In `src/lib/utils/stats.ts`, add:

```ts
import type { FilterState } from "@/lib/types/stats";

export interface StatsQueryInput {
  userId: string;
  lastNRounds?: number;
  startDate?: number;
  endDate?: number;
  excludeClubIds?: string[];
  holeCountFilter?: "all" | "9" | "18";
}

// Timestamps are epoch milliseconds end-to-end (matches rounds.timestamp).
export function buildStatsQueryInput(
  userId: string,
  filters: FilterState,
): StatsQueryInput {
  const input: StatsQueryInput = { userId };

  if (filters.mode === "lastN") {
    input.lastNRounds = filters.lastNRounds;
  } else {
    if (filters.startDate) input.startDate = filters.startDate.getTime();
    if (filters.endDate) input.endDate = filters.endDate.getTime();
  }

  if (filters.excludeClubIds.length > 0) {
    input.excludeClubIds = filters.excludeClubIds;
  }
  if (filters.holeCountFilter) {
    input.holeCountFilter = filters.holeCountFilter;
  }
  return input;
}
```

In `stats-dashboard.tsx`, replace the body of the `queryInput` `useMemo`
(lines 40–70 in current state) with:

```ts
const queryInput = useMemo(
  () => buildStatsQueryInput(userId, filters),
  [userId, filters],
);
```

and remove the now-unused inline input type. Import `buildStatsQueryInput`
from `@/lib/utils/stats`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Fix the misleading comment in the router

In `src/lib/trpc/router/stats.ts:9`, change
`// Date range filter (Unix timestamps)` to
`// Date range filter (epoch milliseconds — matches rounds.timestamp)`.

**Verify**: `grep -n "Unix timestamps" src/` → no matches.

### Step 5: Tests

Extend `src/lib/utils/stats.test.ts` (model after the existing tests from plan
003) with a `buildStatsQueryInput` block:

- lastN mode: emits `lastNRounds`, omits dates even when set.
- dateRange mode: `startDate`/`endDate` emitted as **`getTime()` ms values**
  (assert exact equality with `date.getTime()` — this is the regression test
  for the seconds bug).
- null dates omitted; empty `excludeClubIds` omitted; non-empty passed through.

**Verify**: `pnpm test` → all pass, including the new block.

### Step 6: Manual smoke

`pnpm dev`, open `http://localhost:3000/stats`, switch the mode toggle to
date-range, pick "Last 90 days": charts must show data (the seeded rounds span
recent months) and the Select must keep displaying "Last 90 days".

**Verify**: non-empty charts + persistent Select label. (If the seeded data is
older than 90 days by the time you run this, "All time" must show all 95
rounds — check the "Rounds" summary stat.)

## Test plan

Covered in Step 5. Regression case: query input dates equal `Date.getTime()`
(ms), never `/1000`.

## Done criteria

- [ ] `pnpm test` exits 0, including new `buildStatsQueryInput` tests
- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] `grep -rn "getTime() / 1000" src/` → no matches
- [ ] `grep -rn "require(" src/app` → no matches
- [ ] Manual smoke (Step 6) shows data in date-range mode
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Round timestamps in the live database are NOT in milliseconds (check:
  `SELECT timestamp FROM rounds LIMIT 1` via `pnpm db:studio` or the seeded
  `data.json` — values must be 13 digits). If they're 10-digit seconds, the
  fix direction is inverted and this plan is wrong as written.
- `FilterState` has drifted (a `datePreset`-like field already exists).
- Step 6 shows an empty dashboard for "All time" — something besides units is
  broken; report findings.

## Maintenance notes

- Timestamps are epoch **ms** end-to-end. Any future feature reading
  `rounds.timestamp` (round entry, per-hole view) must keep this unit.
- Follow-up deferred: a custom calendar date-range picker (the `'custom'`
  concept the old code hinted at).
- Plan 006 touches `stats-dashboard.tsx` too — execute sequentially, not in
  parallel worktrees.
