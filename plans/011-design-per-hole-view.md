# Plan 011: Design spike — per-hole scorecard and hole-trend view

> **Executor instructions**: This is a **design spike, not a build plan**. The
> deliverable is a design document, not production code. If anything in "STOP
> conditions" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: Written against commit `b482f63` plus an
> uncommitted working tree. Verify the excerpts below against the live files.

## Status

- **Priority**: P3
- **Effort**: M (spike; resulting build is M)
- **Risk**: LOW (no production code)
- **Depends on**: plans/009-design-round-entry.md (shares the course-par
  decision — read its design doc first if it exists)
- **Category**: direction
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The `round_holes` table holds complete hole-by-hole strokes for all 95 seeded
rounds (75×9 + 20×18 holes), and the app uses it for exactly one thing: a
`count(*)` in the hole-count filter (`router/stats.ts:53-60`). The most
granular data in the database renders nothing. A scorecard view (per round)
and hole-trend view (per hole number across rounds — "I always blow up on
hole 7") are cheap relative to the data already being in place, and they give
the dashboard a drill-down level it currently lacks: today you can see THAT a
round was bad, never WHERE.

## Current state (facts to design against)

- `roundHoles` (`src/lib/db/schema.ts:75-88`): `roundId`, `holeNumber`,
  `strokes`; PK (roundId, holeNumber); index on roundId. No par, no putts, no
  fairway flag per hole — per-hole detail beyond strokes lives only in the
  aggregated `roundStats` columns.
- **Par gap**: without hole pars there is no per-hole over/under coloring
  (birdie/bogey). Plan 009's design decides whether a `courseHoles` par table
  exists. This spike must produce a design that works BOTH ways: strokes-only
  (absolute numbers + per-hole averages) and par-aware (relative coloring),
  with par-aware gated on 009's outcome.
- No round-detail route exists; the only stats surface is `/stats`
  (`src/app/stats/page.tsx` → `StatsDashboard`). No procedure returns
  `roundHoles` rows.
- Reusable pieces: `StatsBarChart`
  (`src/app/stats/_components/charts/stats-bar-chart.tsx`), `StatsLineChart`,
  shadcn `table` is NOT installed (components/ui has no table.tsx — the
  design should note adding it via shadcn CLI or composing a simple grid),
  `tabs.tsx` IS installed (candidate for a scorecard/trends tab split).
- Router conventions: `router/stats.ts` — zod input, `publicProcedure.query`,
  drizzle select with joins, `satisfies TRPCRouterRecord`.
- The dashboard's filter state (`FilterState`) and `getRoundStats` output
  include `roundId` — a natural navigation hook (click a point → round
  detail).

## Deliverable

Write `plans/design-per-hole-view.md` containing:

1. **Feature scope recommendation**: scorecard-per-round vs hole-trends vs
   both; where each lives (recommendation to evaluate: `/stats/rounds/[id]`
   for scorecard; a "Holes" tab or section on `/stats` for trends).
2. **API design**: procedure signatures with zod schemas — e.g.
   `getRoundDetail({ roundId })` returning round + holes + stats, and
   `getHoleTrends({ userId, ...filters })` returning per-holeNumber averages
   (define the SQL aggregation; note the 9 vs 18-hole comparability problem:
   hole 7 on a 9-hole course is not hole 7 on an 18 — decide whether trends
   group by club+holeNumber or holeNumber alone, and defend the choice).
3. **UI design**: scorecard layout (9/18-hole grids, front/back nine split),
   what renders without par data vs with it, empty/loading states, and how
   navigation from the dashboard works.
4. **Open questions** with recommendations (par dependency on 009; whether
   `puttsPerHole`-style per-hole putts should be captured going forward —
   schema addition, ties to 009's entry model).
5. **Build-plan skeleton**: ordered steps + effort for a future executor.

## Investigation steps

1. Read the files in Current state; read `plans/design-round-entry.md` if it
   exists (par decision).
2. Sample `data.json` `holeStrokes` arrays to sanity-check value ranges (are
   there zeros/nulls for skipped holes?). Read-only.
3. Sketch the trend aggregation SQL against the real schema (on paper in the
   doc — do not create procedures).
4. Write the deliverable.

## Scope

**In scope**: creating `plans/design-per-hole-view.md`. Read-only analysis.
**Out of scope**: ANY production code change; installing shadcn components.

## Done criteria

- [ ] `plans/design-per-hole-view.md` exists and covers all 5 sections
- [ ] The 9-vs-18-hole trend-comparability problem is addressed explicitly
- [ ] The design degrades gracefully without par data (stated, not implied)
- [ ] No production files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `data.json` absent — the holeStrokes sanity check needs it; report.

## Maintenance notes

- If plan 009 chooses summary-only entry (no per-hole strokes for new rounds),
  hole views only cover imported rounds — the design doc must flag this
  interaction so the maintainer sees the coupling before building either.
