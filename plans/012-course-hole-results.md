# Plan 012: Course hole results (eagle / birdie / par per Hole)

> **Executor instructions**: Build plan. Read `GLOSSARY.md` and
> `docs/adr/0001-par-on-played-hole.md` first — use their terms in code and UI
> copy. If anything in "STOP conditions" occurs, stop and report. When done,
> update the status row in `plans/README.md`.
>
> **Drift check (run first)**: Written against commit `a674b8f`. Verify the
> excerpts below against the live files.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive column, new page; `/stats` untouched)
- **Depends on**: none. Settles the par decision that plans 009 and 011 were
  waiting on.
- **Category**: feature
- **Planned at**: commit `a674b8f`, 2026-11-05
- **Linear**: KOI-395

## Why this matters

The user wants a per-Course checklist: for every Hole, the Best Result ever
made (Eagle or Better / Birdie / Par) and how often, so it's visible which
Holes are conquered and which are Not Yet. The export has hole strokes but
**no per-hole par anywhere** — only each Round's total par
(`strokes - score`) and per-Round Result counts (`stats.birdies` etc.).

## Decisions (settled with the user — do not relitigate)

1. **Par lives on the Played Hole** (`round_holes.par`, nullable). A Hole's
   Usual Par is a default; tee variants exist (Riverside #1 plays 3 or 4).
2. **A committed par file is the source of truth**: `src/lib/db/course-pars.json`.
   `db:seed` only reads it. A solver script proposes entries; it is not run by
   seed.
3. **Tee variant picked by Round total par**: for each Round, use Usual Pars;
   if their sum ≠ the Round's total par, try the listed variants and take the
   combination whose sum matches. No match → that Round's holes get `par = null`
   and seed logs a warning.
4. **9-hole Course played as 18** (Hancock): Played Holes 10–18 map onto
   Holes 1–9 (`hole = ((playedHole - 1) % courseHoleCount) + 1`).
5. **Every Round counts**, fully logged or not. Played Holes with `strokes = 0`
   are ignored.
6. **Results**: Eagle or Better (≤ −2, includes albatross and Ace), Birdie
   (−1), Par (0). Over Par is not shown. Ace = `strokes === 1`, flagged
   separately.
7. **Par Unknown**: a Hole whose Usual Par is `null` in the par file. Its Played
   Holes get no Result; the cell renders greyed with "?".
8. **UI**: new `/courses` page. Out of scope: dates, drill-down into a Hole,
   any filters.

## Current state (facts to build against)

- `roundHoles` (`src/lib/db/schema.ts`): `roundId`, `holeNumber`, `strokes`;
  PK (roundId, holeNumber). No par.
- Seed hole loop (`src/lib/db/seed.ts` ~line 95):
  ```ts
  for (let i = 0; i < round.holeStrokes.length; i++) {
    await db.insert(roundHoles).values({
      roundId: round.id,
      holeNumber: i + 1,
      strokes: round.holeStrokes[i],
    });
  }
  ```
- Round total par = `round.strokes - round.score`. Counts in `round.stats`:
  `aces, doubleEagleOrBetter, eagles, birdies, pars, bogeys, doubleBogeyOrWorse`.
- Data per Course (hole count · total par · rounds), from `local.db`:
  Butler Park P&P 9·27·34, Hancock 9·35·53 and 18·70·10, Morris Williams
  18·72·6, Riverside 18·71·2 and 18·72·3, Lions 18·71·3, Roy Kizer 18·71·2,
  Falconhead 18·72·2, Plum Creek 18·71·2, Pedernales 9·36·2, and single
  Rounds at Alsatian 71, Brackenridge 71, Hermann Park 70, Jimmy Clay 72,
  Stonybrook 9·35, Golden Nugget 72. All 9-hole Rounds are on 9-hole Courses.
- Prototype solver results (Python, brute force over 3/4/5 per hole, matched
  against every Round's total par + Result counts): **unique** for Butler (all
  3s), Hancock `[4,4,4,4,3,5,4,3,4]`, Morris Williams
  `[4,5,3,4,5,4,4,3,4, 4,5,3,4,3,4,4,5,4]`. Ambiguous: Roy Kizer, Lions, Golden
  Nugget, Alsatian (and every single-Round Course).
- Router conventions: `router/stats.ts` — zod input, `publicProcedure.query`,
  drizzle select, `satisfies TRPCRouterRecord`; registered in
  `router/_app.ts`. Tests use `createTestDb()` from `src/lib/db/test-helpers.ts`
  (in-memory, real migrations) — see `router/stats.test.ts` for caller pattern.
- UI kit (`src/components/ui`): card, badge, select, tabs, etc. No table.

## Steps

1. **Schema**: add `par: integer()` (nullable) to `roundHoles`. Run
   `pnpm db:generate`; commit the migration.
2. **Solver script** `src/lib/db/solve-pars.ts` (run with `pnpm tsx`): for each
   Course, group Rounds by (hole count, total par); brute-force par vectors
   (3/4/5 per hole; split 18 into two 9-hole halves keyed by per-Round partial
   counts to stay under ~40k candidates each); a Hole's par is known if every
   surviving solution agrees, else `null`. Collapse an 18-hole solution onto
   9 Holes when the Course has 9-hole Rounds and both halves agree. Print a
   proposed `course-pars.json`; do not write it automatically.
3. **Par file** `src/lib/db/course-pars.json`, keyed by club id:
   ```json
   {
     "8ae88a70-86ac-11e4-8c28-020000005b00": {
       "name": "Hancock Golf Course",
       "pars": [4, 4, 4, 4, 3, 5, 4, 3, 4]
     },
     "8c8b6500-86ac-11e4-8c28-020000005b00": {
       "name": "Riverside Golf Course Austin",
       "pars": [4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5],
       "variants": { "1": [3, 4] }
     }
   }
   ```
   `pars.length` is the Course's hole count; `null` = Par Unknown; `variants`
   maps Hole number → alternative pars. (Riverside pars above are
   illustrative, not real — take them from the solver/scorecard.) Every
   played Course gets an entry.
   Seed it from the solver output; leave ambiguous Holes `null` for the user
   to fill from scorecards (Roy Kizer, Lions, Golden Nugget, Alsatian +
   single-Round Courses). Riverside: the solver will show two solutions
   (par 71 vs 72 groups) — record the 72 layout with `variants: {"1": [3, 4]}`
   and confirm hole 1 is the only difference.
4. **Seed**: pure function `parsForRound(courseEntry, holeCount, totalPar)` →
   `(number | null)[]` per Played Hole (fold for 9-hole Courses, variant
   matching per Decision 3). Write `par` in the hole loop. Missing Course entry
   → all `null` + warning.
5. **Aggregation**: pure function in `src/lib/utils/course-holes.ts`,
   `summarizeHoles(rows, courseHoleCount)` → per Hole
   `{ hole, usualPars: number[], timesPlayed, eagleOrBetter, birdies, pars,
   aces, best: 'eagleOrBetter' | 'birdie' | 'par' | 'notYet' | 'parUnknown' }`.
   `usualPars` = distinct pars seen (Riverside #1 → `[3, 4]` renders "3/4").
6. **Router** `src/lib/trpc/router/courses.ts`, register as `courses`:
   - `list({ userId })` → Courses played with round counts, sorted desc.
   - `holeResults({ userId, clubId })` → Course name, hole count, summarized
     Holes, plus progress `{ parOrBetter, birdied, total }`.
7. **Page** `src/app/courses/page.tsx`: course `Select` (default most-played),
   progress line ("7/9 Holes Par or better · 4 birdied"), grid of Hole cells
   (9 per row; 18 = two rows). Cell: Hole number, Usual Par, Best Result
   badge, `E ×n · B ×n · P ×n`, times played. Not Yet = dimmed; Par Unknown =
   greyed "?"; Ace badge when `aces > 0`. Add a nav link if the layout has one.
8. **Docs**: mark plans 009/011 README rows noting the par decision is settled
   by ADR 0001.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`.
- Unit tests: `parsForRound` (fold 18→9, Riverside variant picks 3 on a par-71
  Round and 4 on par-72, no-match → nulls); `summarizeHoles` (Ace counted in
  Eagle or Better, 0-stroke holes skipped, Par Unknown, Not Yet).
- Router test against `createTestDb()` for `holeResults`.
- After `pnpm db:reset && pnpm db:seed`, these must hold (from the prototype):
  - Hancock #8: Best = Birdie, birdies ×3; Hancock #7: birdies ×2.
  - Butler #1: birdies ×3.
  - Morris Williams #5: Birdie ×1.
  - For every Round where all pars are known: count of Results per category
    equals `round_stats` (eagles + aces + doubleEagleOrBetter, birdies, pars).
    Write this as a one-off check query; report mismatches.
- Browser check of `/courses` for Hancock, Butler, Riverside and one
  Par Unknown Course.

## STOP conditions

- Solver yields **zero** solutions for a Course/hole-count group (data
  inconsistent with any 3/4/5 layout) — report the Course and Rounds.
- Riverside differs on more than hole 1 between the 71 and 72 groups.
- Seed consistency check (Verification) shows mismatches for a Course whose
  pars were solved uniquely.
