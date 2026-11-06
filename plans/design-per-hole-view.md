# Design: per-hole scorecard and hole trends

> Spike output for plan 011 / KOI-156. **HITL:** design review. No production code was changed.
>
> Written against the KOI-147 branch tip (`main` plus PRs #2, #4, #5, #6, #7, #8). Plan 011 was written before KOI-395 merged, and that changes its premises:
> - **Par is settled.** [ADR 0001](../docs/adr/0001-par-on-played-hole.md) stores Par on each Played Hole (`round_holes.par`). All 1,440 seeded Played Holes have one, so the "works without par" branch of the plan is now an edge case, not the default.
> - **Hole trends half exist.** `/courses` (KOI-395) already groups Played Holes by **Club + Hole**, wrapping 18-hole Rounds onto 9-hole Courses, and shows Best Result plus eagle/birdie/par counts.
> - **Round entry (`plans/design-round-entry.md`, PR #7)** proposes `/rounds/new` and optional per-hole putts, fairway and GIR columns. This design reuses that route family and those columns. **If round entry instead picks summary-only entry (its option (b)),** entered Rounds have no Played Holes. The scorecard and hole trends would then cover imported Rounds only, and an entered Round's `/rounds/[id]` would show totals with no hole grid.

Terms follow [`GLOSSARY.md`](../GLOSSARY.md): Course, Hole, Played Hole, Par, Result, Best Result.

## Data check

From `data.json` (read-only): 1,440 Played Holes across 125 Rounds (90 nine-hole, 35 eighteen-hole). Strokes range **2–13**, with **no zeros or nulls**: no skipped holes in the import. `summarizeHoles` still ignores 0-stroke Played Holes for entered data.

## 1. Feature scope (recommendation)

**Build both, as two small additions to what exists. Don't add a new "Holes" tab on `/stats`.**

| Piece | Where | Why there |
|---|---|---|
| **Scorecard for one Round** | `/rounds/[id]` | It sits with `/rounds/new` from round entry, and it's a Round, not a stats view. You get there from `/stats` (click a chart point) and from a Round list later. |
| **Hole trends** | Extend `/courses` hole cells | `/courses` already groups by Club + Hole, which is the right grouping (§2). Adding "average vs par" to each cell answers "I always blow up on hole 7" without a second view that would need the same wrapping logic. |

A "Holes" tab on `/stats` (the plan's suggestion) would either group by hole number alone (wrong, §2), or duplicate `/courses` with the `/stats` filters on top. Filters on trends are open question 3.

## 2. API design

### Grouping: Club + Hole, wrapped, never hole number alone

Hole 7 at Butler Pitch & Putt (par 3) and hole 7 at Morris Williams (par 4) are different physical holes. Averaging them together means nothing. Even within one Club, grouping by the raw `round_holes.hole_number` is wrong for a 9-hole Course played as 18. At Hancock it yields 18 groups: Played Hole 10 (+0.80, n=10) and Hole 1 (+1.35, n=63) come out as separate rows, though they're the same Hole. Trends therefore group by **Club + Hole**, with Played Holes wrapped onto the Course's hole count. That's exactly what `courses.holeResults` → `summarizeHoles` already does, so trends extend that code rather than adding new SQL.

### `courses.holeResults` (existing): add the average to each Hole

```ts
// HoleSummary gains:
avgOverPar: number | null;   // mean of (strokes − par) over Played Holes with both; null if none
avgStrokes: number | null;   // mean strokes over scored Played Holes, par or not (the strokes-only fallback)
```

The equivalent SQL, for reference only; the code stays in `summarizeHoles`:

```sql
select ((h.hole_number - 1) % :courseHoleCount) + 1 as hole,
       avg(h.strokes - h.par)                       as avg_over_par,
       count(*)                                     as times_played
from round_holes h
join rounds r on r.id = h.round_id
where r.user_id = :userId and r.club_id = :clubId
  and h.strokes > 0 and h.par is not null
group by hole
order by hole;
```

Real output for Hancock (wrapped, 73 Played Holes per Hole): hole 6 is the toughest at +2.75, and hole 8 the easiest at +1.03.

### `rounds.detail({ roundId })` (new; `roundsRouter` from round entry)

```ts
input: z.object({ userId: z.string(), roundId: z.string() })
output: {
  id, timestamp, score, strokes,
  club: { id, name },
  holes: { holeNumber, par, strokes, result: HoleResult | null,
           putts, fairway, gir }[],   // detail columns from round entry; null for imported Rounds
  stats: RoundStatData['…'] | null,    // the derived-stats row, or null if the Round has no round_stats row
} | null                                // null when the Round doesn't exist or isn't this user's → page shows 404

type HoleResult = 'eagleOrBetter' | 'birdie' | 'par' | 'bogey' | 'doubleOrWorse';
```

- `result` comes from a new per-hole helper, `holeResult(strokes, par): HoleResult` in `course-holes.ts`. It can't be `BestResult`: that type is a Hole's lifetime best and has no bogey or double, so the scorecard couldn't draw its squares. Round entry's `roundResultCounts(holes)` should be built on `holeResult`, which keeps the buckets identical everywhere.
- **Stats:** `getRoundStats` computes `fairwayHitPct`, `girPct`, `puttsPerHole` and `puttsPerRound` inline. Pull that into one `withDerivedStats(row)` mapper that both procedures use, so the formulas aren't copied. `getRoundStats` inner-joins `round_stats`; `rounds.detail` left-joins it, and returns `stats: null` when the row is missing.
- Scoped by `userId`, like every other procedure.
- **Tests (router seam):**
  - Holes come back ordered with correct Results.
  - Another user's Round returns `null`.
  - A Round with a Par Unknown Played Hole gives `result: null` for that hole.

## 3. UI design

### Scorecard `/rounds/[id]`

Illustrative 9-hole Round at Hancock (not a real Round):

```text
Hancock Golf Course · <date>                                    41 (+6)
┌──────┬────┬────┬────┬──────┬────┬──────┬────┬────┬────┬─────┐
│ Hole │ 1  │ 2  │ 3  │ 4    │ 5  │ 6    │ 7  │ 8  │ 9  │ Out │
│ Par  │ 4  │ 4  │ 4  │ 4    │ 3  │ 5    │ 4  │ 3  │ 4  │ 35  │
│ Score│ [5]│ (3)│ 4  │ [[6]]│ 3  │ [[7]]│ [5]│ 3  │ [5]│ 41  │
└──────┴────┴────┴────┴──────┴────┴──────┴────┴────┴────┴─────┘
(n) birdie = circle · ((n)) eagle or better = double circle · [n] bogey = square · [[n]] double or worse = double square
Fairways 3/7 · GIR 2/9 · Putts 17
```

- **Markup:** a plain `<table>` with Tailwind classes. There's no shadcn `table.tsx`, and one native table doesn't justify adding it.

- **Front/back split:** an 18-hole Round shows two 9-column rows (Out, then In) plus a Total column. A 9-hole Round shows one row.
- **Result marks:** the scorecard uses golf's own circles and squares. The *colors* match the `/courses` badges (Eagle or Better amber, Birdie emerald, Par sky), so one Result looks the same everywhere.
- **Per-hole detail row** (putts, fairway, GIR): shown only when any Played Hole has it. That's entered Rounds only; imported Rounds have totals but no per-hole detail.
- **Without Par** (a Par Unknown Played Hole, possible only for unusual imports): the scorecard shows strokes with no mark and "—" for that Hole's Par. On `/courses`, a Hole with `avgOverPar: null` shows the strokes-only fallback "avg 4.6 strokes" (`avgStrokes`) instead of "+x.x avg", and isn't eligible for toughest/easiest.
- **Loading:** a server-component prefetch like `/stats`, with a Suspense fallback "Loading round…". **Not found:** `notFound()` → Next's 404.

### Getting there

- **`/stats` charts:** clicking a point opens `/rounds/[roundId]`. `ChartDataPoint` gains `roundId` (`toChartData` already has `r.roundId`), and `StatsLineChart` takes an optional `onPointClick(point)`. Wire it to the **chart-level** `LineChart onClick`, mapping the active tooltip index to `data[i]`. Don't use `Line onClick`: in Recharts 3.6 that fires on the path with no point payload. Don't use `activeDot` either: it only exists while hovering, so it's unreliable on touch. Confirm the index field name (`activeTooltipIndex`/`activeIndex`) against the installed Recharts when building.
- **`/courses`:** each cell shows "+1.4 avg" under the counts. The toughest and easiest Hole get a subtle outline. Only Holes played at least 5 times are eligible, and ties outline every tied Hole. Cells don't link anywhere yet (open question 4).

## 4. Open questions (with recommendations)

1. **Par dependency?** Resolved by ADR 0001. Nothing to decide.
2. **Capture per-hole putts (and fairway/GIR) going forward?** **Yes.** It's the same decision as round entry Q2 (nullable `round_holes` columns). The scorecard's detail row and any later putts-per-hole trend depend on it, and imported Rounds simply show totals.
3. **Should `/courses` trends honour date or hole-count filters?** **Not in v1.** Lifetime averages answer the "always" question. Add a "last N Rounds" toggle later if old Rounds start skewing the numbers.
4. **Drill from a `/courses` cell into that Hole's Rounds?** **Defer.** KOI-395 left drill-down out of scope. Once `/rounds/[id]` exists, a cell popover listing "Rounds where you birdied #8" is cheap to add.
5. **Route: `/rounds/[id]` or `/stats/rounds/[id]`?** **`/rounds/[id]`.** It pairs with `/rounds/new`. A Round is the thing being viewed; `/stats` is only one way in.
6. **Show strokes gained on the scorecard?** **No.** It's 2 of 125 Rounds (`design-strokes-gained.md`).

## 5. Build-plan skeleton

| # | Step | Effort | Depends on |
|---|---|---|---|
| 1 | `avgOverPar` + `avgStrokes` in `summarizeHoles`, and `holeResult(strokes, par)`, with unit tests (averages only Played Holes with par and strokes; wraps onto 9 holes; null when none; all five Results) | S | — |
| 2 | `/courses` cells: "+x.x avg" and toughest/easiest outline | S | 1 |
| 3 | `withDerivedStats` extracted from `getRoundStats` (its tests must pass unmodified), then `rounds.detail` + router tests (order, Results, other user → null, Par Unknown, missing stats row → `stats: null`) | S–M | 1 (`holeResult`) |
| 4 | `/rounds/[id]` scorecard page: front/back rows, Out/In/Total, Result marks, detail row when present, 404 | M | 3 |
| 5 | `/stats` charts → scorecard: `roundId` on `ChartDataPoint`, `onPointClick` on `StatsLineChart` | S | 4 |
| 6 | Browser check: 9-hole, 18-hole, a 9-hole Course played as 18 (Hancock), unknown id → 404 | S | 2, 5 |

Steps 1–2 ship on their own, and soon: they're independent of round entry. Steps 3–6 need the `roundsRouter` from round entry, or create it here if this lands first.
