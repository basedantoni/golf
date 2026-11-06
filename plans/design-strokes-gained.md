# Design: strokes-gained and recommended stats display

> Spike output for plan 010 / KOI-147. **HITL:** design review. No production code was changed.
>
> Written against the KOI-146 branch tip (`main` plus PRs #2, #4, #5, #6, #7). The data now has **125** Rounds, not the plan's 95. `movingAverage`, which the plan suggested reusing, is deleted by PR #5.

**Headline:** only **2 of 125 Rounds** have real strokes-gained data, both played on 2026-04-14. None of the 46 Rounds since has any. A strokes-gained chart would be two dots, and it may stay that way. **Recommendation:** fix the schema (cheap, and it makes the data honest), defer the UI, and drop `round_recommended_stats` as a redundant copy. Details below.

## 1. Data semantics

All numbers come from `data.json` (125 Rounds) via a read-only `python3 -I` pass, cross-checked against `local.db`. The core of it:

```python
rs = json.load(open("data.json"))["activityData"]["rounds"]
v = [r["stats"]["strokeGainOverall"] for r in rs]        # same for strokeGainTeeToGreen
sentinel = sum(x == 100 for x in v)                       # 123
real = [x for x in v if x != 100]                         # 2 values; min/median/max via statistics
# recommendedStats: group r["stats"]["recommendedStats"] by "type", and compare each value
# with the round_stats field it names (e.g. TOTAL_PUTTS vs stats["putts"], |Δ| < 1e-5)
# shots per Round: len(r.get("shotEntries", []))
```

### Strokes gained

| Field | Sentinel `100` | Real values | Real min / median / max | Non-integer |
|---|---|---|---|---|
| `strokeGainOverall` | **123 / 125** | 2 | −30.64 / −18.67 / −6.71 | 2 / 2 |
| `strokeGainTeeToGreen` | **123 / 125** | 2 | −23.82 / −13.71 / −3.60 | 2 / 2 |

- **The two fields are sentinel together.** On every Round, either both are real or both are `100`.
- **The 2 real Rounds** are both on 2026-04-14: an 18-hole Round with score +24 and SG −30.64, and a 9-hole Round with score +6 and SG −6.71.
- **Why only those two: unknown.** What the data rules out:
  - **Logging putts and GIR isn't enough.** 105 of the sentinel Rounds log both.
  - **The subscription isn't the cause.** It was active until 2026-07-17, yet no other Round has a value.
  - **Shot tracking alone doesn't explain it.** `shotEntries`, the per-Round shot list under `activityData.rounds[]`, appears on 38 Rounds. The 18-hole strokes-gained Round has 34 tracked shots, the most of any Round. But the 9-hole one has only 8, while five sentinel 9-hole Rounds have 8–13.

  The only clean pattern is the date. Plan as though the source app's strokes-gained output is rare and outside our control.
- **Units:** totals for the Round, so 18-hole values are about twice the magnitude of 9-hole ones. Any average has to normalize per 18 holes (see §3).
- **What the numbers mean:** strokes relative to the source app's baseline for the Round. Negative means worse than baseline, and SG Overall is roughly as bad as the score is high. The baseline itself (scratch? handicap-matched?) can't be determined from 2 data points. Flagged as unresolvable from the data.
- **`100` is a no-data sentinel,** not a measurement. Strokes gained of +100 in a Round isn't possible, so a genuine 100 never needs preserving.

### `recommendedStats` inventory (all 9 types)

| Type | Rounds | Range | Same as an existing column? |
|---|---|---|---|
| `FAIRWAY_HIT_PERCENTAGE` | 80 | 0 – 0.857 | **80/80** = `fairwayMiddles / fairwayHoleCount` |
| `GIR_PERCENTAGE` | 80 | 0 – 0.444 | **80/80** = `gir / girHoleCount` |
| `TOTAL_PUTTS` | 82 | 1 – 46 | **82/82** = `putts` |
| `TOTAL_BIRDIES` | 43 | 0 – 2 | **43/43** = `birdies` |
| `TOTAL_PARS` | 43 | 0 – 7 | **43/43** = `pars` |
| `TOTAL_BOGEYS` | 43 | 1 – 10 | **43/43** = `bogeys` |
| `SG_OVERALL` | 2 | −30.64, −6.71 | **2/2** = `strokeGainOverall` |
| `SG_TEE` | 1 | −4.08 | no (only source) |
| `SG_APPROACH` | 1 | −0.45 | no (only source) |

`noStats` is false on every row. 7 of the 9 types duplicate a `round_stats` value exactly. The only information unique to this table is **two numbers on two Rounds** (`SG_TEE`, `SG_APPROACH`). Nothing reads the table: `grep` finds only `schema.ts` and `seed.ts`.

## 2. Schema fix

```ts
// round_stats: real-valued, null = not computed (replaces integer + 100 sentinel)
strokeGainOverall: real("stroke_gain_overall"),
strokeGainTeeToGreen: real("stroke_gain_tee_to_green"),
```

- **Migration:** `pnpm db:generate`. SQLite can't `ALTER COLUMN`, so drizzle-kit generates a table rebuild (`__new_round_stats` → copy → drop → rename). Check the generated SQL keeps every other column and the `round_id` FK. Append the data step to the end of the generated migration, **after** the rename, so it updates the rebuilt table:
  ```sql
  UPDATE round_stats SET stroke_gain_overall = NULL WHERE stroke_gain_overall = 100;
  UPDATE round_stats SET stroke_gain_tee_to_green = NULL WHERE stroke_gain_tee_to_green = 100;
  ```
  False-positive risk is nil, because +100 strokes gained isn't a real value (§1). Locally, `db:reset` rebuilds everything anyway; the backfill matters only for a database that isn't reseeded.
- **Seed:** map the source's `100` to `null` in `seed.ts` (`v === 100 ? null : v`), so new imports never write the sentinel.
- **Knock-on:** round entry (KOI-146, §3 of `design-round-entry.md`) no longer needs to pass `null` explicitly. Once the default is gone, omitting the field gives `null`.

## 3. UI proposal

**Recommend deferring strokes-gained UI** until at least ~10 Rounds carry real values. **This may never happen:** none of the 46 Rounds since 2026-04-14 has strokes gained, and in-app entry (KOI-146) can't produce it. Closing the UI half as "won't do for now" is a reasonable outcome.
- A line chart with a zero baseline and 2 points shows no trend.
- A summary tile ("SG −18.7 · 2 Rounds") would sit next to tiles averaging 100+ Rounds and look comparable when it isn't.
- Strokes-gained data only arrives when the source app tracks shots, and in-app entry (KOI-146) can't produce it.

When it is justified, the shape is:
- `StatsLineChart` "Strokes Gained" with `targetValue={0}`: the reference line reads "Target: 0", the same derivation as the other charts. No trend line; `movingAverage` is gone, and re-adding it is part of this build.
- A summary tile averaging non-null values over the filtered Rounds, **normalized per 18 holes** (× 18 / Played Holes, like `puttsPerRound`), showing the count: "SG −4.2 / 18 (12 Rounds)".

**Recommended stats: don't display them.** They duplicate what `/stats` already shows (§1).

## 4. API change

`getRoundStats` already selects `strokeGainOverall` and `strokeGainTeeToGreen`, and the client type is already `number | null`: the columns are nullable, `.default(100)` without `.notNull()`. The schema fix changes the values (the sentinel becomes `null`), not the type. **No API work** is needed for the deferred UI. When the chart lands, it's `toChartData(rounds, "strokeGainOverall")`, which already drops nulls.

## 5. Open questions (with recommendations)

1. **Fix the schema now even though there's no UI?** **Yes.** It's one small migration, it removes a sentinel every future reader would trip on, and it simplifies round entry. Land it before any strokes-gained UI.
2. **Build the strokes-gained chart or tile now?** **No.** 2 data points, and the reason is structural (shot tracking). Revisit when the export has ≥10 real Rounds.
3. **What to do with `round_recommended_stats`?** **Drop it.** Remove the table, its seed loop and its schema export in one migration. It's 100% redundant apart from `SG_TEE`/`SG_APPROACH` on one Round each. If tee/approach strokes gained ever matter, add two nullable `round_stats` columns instead of a key/value table. Alternative: keep seeding it untouched, which costs nothing at runtime but keeps a dead table.
4. **Keep `SG_TEE` / `SG_APPROACH` before dropping the table?** **No.** They're 2 values on 2 Rounds. They do survive in your local `data.json`, but that file is git-ignored, so keep a copy of the export if you think you'll want them.
5. **Re-add a moving average for the eventual chart?** **Only with the chart.** It was deleted as unused (#5); bring it back in the same change that first uses it.

## 6. Build-plan skeleton

| # | Step | Effort |
|---|---|---|
| 1 | Schema: `strokeGain*` → `real()`, no default. Generate the migration, add the sentinel→NULL backfill, review the rebuild SQL. `seed.ts` maps 100 → null. Check: `db:reset` gives 2 non-null Rounds; `drizzle-kit migrate` afterwards is a no-op | S |
| 2 | (If Q3 = drop) remove `round_recommended_stats`: table, seed loop, schema export; migration drops the table | S |
| 3 | (Deferred until ≥10 real Rounds) "Strokes Gained" line chart with a 0 target, summary tile with Round count, and `movingAverage` if wanted, with tests | S–M |

Steps 1 and 2 can be one PR. Step 3 waits for data.
