# Plan 010: Design spike — surface strokes-gained and recommended stats

> **Executor instructions**: This is a **design spike, not a build plan**. The
> deliverable is a design document, not production code. If anything in "STOP
> conditions" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: Written against commit `b482f63` plus an
> uncommitted working tree. Verify the excerpts below against the live files.

## Status

- **Priority**: P3
- **Effort**: S (spike; resulting build is S–M)
- **Risk**: LOW (no production code)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The data model collects two whole categories of stats that the UI never
shows. `strokeGainOverall` / `strokeGainTeeToGreen` are **selected by the
stats router on every request** (`router/stats.ts:109-110`) and then dropped
on the floor — no chart, no summary, not even a type field on `RoundStatData`.
The `roundRecommendedStats` table (typed key/value stats per round, e.g.
`TOTAL_BIRDIES`) is seeded with data and **never queried anywhere in the
app**. Strokes gained is the single most requested advanced golf metric; the
data is already in the database.

## Current state (facts to design against)

- Schema (`src/lib/db/schema.ts:131-132`):
  ```ts
  strokeGainOverall: integer("stroke_gain_overall").default(100),
  strokeGainTeeToGreen: integer("stroke_gain_tee_to_green").default(100),
  ```
  Two problems verified from `data.json` (95 rounds):
  - Values are **floats** (min `-30.639992`, max `100`) stored in an
    `integer()` column — SQLite's dynamic typing preserves them, but the
    declared type is wrong and drizzle types them as plain `number`.
  - `100` is clearly a **"no data" sentinel**, not a measurement (mean is
    97.5 only because most rounds carry the sentinel; real values are small
    negatives/positives around 0). Charting raw values would be nonsense.
- `roundRecommendedStats` (`schema.ts:142-156`): `roundId`, `type` (text,
  e.g. `TOTAL_BIRDIES`, `TOTAL_PARS`, `TOTAL_BOGEYS` — full type inventory
  unknown, enumerate from `data.json` during the spike), `noStats` boolean,
  `value` real. Seeded by `seed.ts:132-140`; `grep -rn roundRecommendedStats
  src/` hits only schema and seed — zero readers.
- Existing chart building blocks to reuse: `StatsLineChart`
  (`src/app/stats/_components/charts/stats-line-chart.tsx` — props: title,
  data: `ChartDataPoint[]`, color, unit, target line, yDomain),
  `toChartData` + `movingAverage` (`src/lib/utils/stats.ts`), dashboard grid
  (`stats-dashboard.tsx`).
- `RoundStatData` (`src/lib/types/stats.ts`) — would need
  `strokeGainOverall` etc. added.

## Deliverable

Write `plans/design-strokes-gained.md` containing:

1. **Data semantics report**: enumerate all `recommendedStats.type` values in
   `data.json` with example values; determine what the strokes-gained numbers
   mean (per-round strokes gained vs a baseline? which baseline?) as far as
   the data allows; document the `100` sentinel prevalence (how many of 95
   rounds are sentinel vs real).
2. **Schema fix proposal**: `real()` column type + `null` default replacing
   the `100` sentinel, the drizzle migration, and the data backfill
   (`UPDATE ... SET x = NULL WHERE x = 100`) with its false-positive risk
   (a genuine 100 is implausible — strokes gained of +100 doesn't exist —
   state this) and how seeding maps source `100` → `NULL` going forward.
3. **UI proposal**: which charts/tiles to add (recommended shape: one
   `StatsLineChart` for strokes gained overall with `movingAverage` trend and
   `targetValue={0}` baseline; summary tile for average over filtered rounds
   excluding nulls; recommended-stats display only if the type inventory
   justifies it — otherwise recommend deferring `roundRecommendedStats` and
   say why).
4. **API change**: whether `getRoundStats` already returns what's needed
   (it selects the columns — likely only the client type + null handling
   change) or needs work.
5. **Open questions** with recommendations, and a **build-plan skeleton**
   (ordered steps + effort) for a future executor.

## Investigation steps

1. Analyze `data.json`: distribution of both strokeGain fields, full
   `recommendedStats.type` inventory (a few lines of Node or Python against
   the file; run read-only, write nothing outside `plans/`).
2. Read the files listed in Current state.
3. Write the deliverable.

## Scope

**In scope**: creating `plans/design-strokes-gained.md`. Read-only analysis.
**Out of scope**: ANY production code, schema, or migration change.

## Done criteria

- [ ] `plans/design-strokes-gained.md` exists and covers all 5 sections
- [ ] Sentinel count (X of 95 rounds) stated with the analysis method shown
- [ ] Full `recommendedStats.type` inventory listed
- [ ] No production files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `data.json` absent — report instead of guessing semantics.

## Maintenance notes

- The schema fix (integer→real, sentinel→null) should land as its own small
  migration BEFORE any UI work — the resulting build plan should sequence it
  first and update `seed.ts` in the same change.
