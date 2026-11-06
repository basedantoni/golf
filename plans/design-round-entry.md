# Design: round entry (create Rounds in the app)

> Spike output for plan 009 / KOI-146. **HITL:** the maintainer picks the entry model (§1) and answers §5 before a build plan is written. No production code was changed.
>
> Written against the KOI-359 branch tip, i.e. `main` plus PRs #2, #4, #5 and #6. Two things in plan 009's "Current state" have changed since it was written:
> - **The par decision is already made.** [ADR 0001](../docs/adr/0001-par-on-played-hole.md) puts Par on each Played Hole (`round_holes.par`), with Usual Pars and tee variants in `src/lib/db/course-pars.json`. So the "no par data anywhere" gap no longer exists.
> - **The form stack is gone.** `react-hook-form`, `@hookform/resolvers` and `components/ui/form.tsx` are removed by PR #5 (KOI-357), so this design doesn't assume them.

Terms follow [`GLOSSARY.md`](../GLOSSARY.md): Course, Club, Hole, Played Hole, Par, Usual Par, Round, Result.

## Evidence: what `score` and `strokes` mean

Checked against all 125 seeded Rounds (`local.db` after `pnpm db:reset`, with pars from `course-pars.json`):

| Check | Rounds matching |
|---|---|
| `rounds.strokes = Σ round_holes.strokes` | 125 / 125 |
| `rounds.strokes − rounds.score = Σ round_holes.par` | 125 / 125 |

So **`score` is strokes relative to par** (+14 means 14 over), and **`strokes` is the hole total**. Both are derivable from hole strokes plus the Par of each Played Hole. Entry never has to ask for either.

Stat coverage in the import:
- 81 of 125 Rounds log fairways.
- 107 log GIR.
- 108 log putts.

Manual entry should keep all three optional.

## 1. Data-entry model (recommendation)

**Recommend (c), as ADR 0001 now makes it: hole-by-hole strokes, with each Hole's Par prefilled and editable, and optional per-hole detail.**

| Option | Work | Data quality | Fit with what exists |
|---|---|---|---|
| (a) Hole-by-hole + a new `courseHoles` table | High | Best | Duplicates ADR 0001's par file. Two sources of par would drift apart. |
| (b) Summary only (type totals into `roundStats` fields) | Low | Poor | No Played Holes, so `/courses` never sees these Rounds. Score has to be typed by hand. |
| **(c) Hole-by-hole, Par per Played Hole prefilled, optional detail** | Medium | Best | Writes the same shape the seed writes (`round_holes.strokes` + `par`). `/courses` and `/stats` work unchanged. |

How (c) works:
- **Prefill.** Each Hole's Par comes from its Course's Usual Par in `course-pars.json`. If the Course has no entry there, it falls back to the Par of the same Hole in the user's most recent Round at that Club. Otherwise the field starts empty and the user types it.
- **Tee variants.** The user edits a Par field (Riverside #1: 3 ↔ 4). The edited value is stored on that Played Hole, exactly as ADR 0001 intends.
- **Par is required on every Played Hole.** That keeps `rounds.score` (NOT NULL) always derivable, and no entered Round is Par Unknown.
- **Server-side derivation.** `score`, `strokes`, and the Result counts in `roundStats` (aces, eagles, birdies, pars, bogeys, double+) are computed on the server. Fairway, GIR and putt totals are computed from the optional per-hole detail.

## 2. Schema changes

```ts
// rounds: give new rows an id (seeded rows keep their export UUIDs)
id: text().primaryKey().$defaultFn(() => nanoid()),

// roundHoles: optional per-Played-Hole detail (null = not logged)
putts: integer(),
fairway: text({ enum: ['hit', 'left', 'right', 'short', 'long'] }),   // null on par 3s
gir: text({ enum: ['hit', 'left', 'right', 'short', 'long', 'noChance'] }),
```

- `$defaultFn` is runtime-only, so it needs no migration. The three `roundHoles` columns need one: `pnpm db:generate` → `0003_*.sql` with three `ALTER TABLE … ADD`. The columns are nullable, so seeded rows are unaffected.
- **No `courseHoles` table** (see option (a)). The par file stays the source of truth per ADR 0001.
- **Why per-hole detail lives on `roundHoles`, not only as totals:** plan 011 (per-hole view) needs it. The totals in `roundStats` keep being written too, because `/stats` and the fully-logged filter read them.

## 3. API design

New `roundsRouter` (`src/lib/trpc/router/rounds.ts`), registered as `rounds`.

```ts
const holeInput = z.object({
  holeNumber: z.number().int().min(1).max(18),          // Played Hole number (back nine = 10–18)
  par: z.number().int().min(3).max(6),
  strokes: z.number().int().min(1).max(15),
  putts: z.number().int().min(0).max(9).nullable(),
  fairway: z.enum(['hit', 'left', 'right', 'short', 'long']).nullable(),
  gir: z.enum(['hit', 'left', 'right', 'short', 'long', 'noChance']).nullable(),
});

const createRoundInput = z.object({
  userId: z.string(),
  club: z.union([z.object({ id: z.string() }), z.object({ name: z.string().trim().min(1) })]),
  timestamp: z.number().int(),                           // epoch ms, like rounds.timestamp
  holes: z.array(holeInput)
    .refine((h) => h.length === 9 || h.length === 18, 'A Round is 9 or 18 Played Holes')
    .refine((h) => new Set(h.map((x) => x.holeNumber)).size === h.length, 'Duplicate hole'),
});
```

Procedures:
- **`rounds.prefillPars({ userId, clubId, holeCount, startHole })` → `(number | null)[]`.** Resolves in this order: `course-pars.json` entry (via `parsForRound`, wrapping 9-hole Courses), then the most recent Round at that Club, then `null`. It reuses `courseParEntry` from `src/lib/db/round-pars.ts`.
- **`rounds.create(createRoundInput)` → `{ id }`.** It runs in one `ctx.db.transaction(async (tx) => …)`:
  1. If `club.name` was given, insert into `clubs` with a nanoid id.
  2. Insert into `rounds` with `strokes = Σ strokes` and `score = strokes − Σ par`.
  3. Insert the `roundHoles` rows (strokes, par and detail).
  4. Insert one `roundStats` row:
     - Result counts come from a shared `resultOf(strokes, par)`, extracted from `summarizeHoles` so seed, `/courses` and entry bucket Results identically.
     - Fairway direction counts and `fairwayHoleCount` count only non-null `fairway`.
     - GIR counts and `girHoleCount` work the same way for `gir`.
     - `putts` and `puttHoleCount` are the sum and count of non-null `putts`.
     - `strokeGain*` stay null: the export computed those and we can't.
  5. Upsert `userPlayedClubs`.

  Any failure rolls back the whole Round. drizzle-orm 0.45.4's libsql session exposes `transaction()`; it's verified in the installed `.d.ts`, but not exercised yet.
- **Client:** `useMutation(trpc.rounds.create.mutationOptions({ onSuccess }))`. `onSuccess` invalidates `stats.getRoundStats`, `stats.getClubs`, `courses.list` and `courses.holeResults`, then navigates.

Tests (router seam, in-memory db + `createCaller`, like `courses.test.ts`):
- create → `stats.getRoundStats` returns the Round with the derived score.
- `courses.holeResults` counts its Results.
- An invalid hole count is rejected.
- A failure in the middle of the transaction leaves no partial rows.
- `prefillPars` fallback order.

## 4. UI design

- **Route:** `/rounds/new` (`src/app/rounds/new/page.tsx`), with a "New round" link on `/stats` and `/courses`.
- **Form: plain React state + the same zod schema, no form library.** `react-hook-form` was just removed (#5). An 18-row grid of number inputs doesn't need it, and adding it back would reverse that PR. Client-side, `createRoundInput.safeParse(state)` gives inline errors, and the server validates again with the same schema.
- **Layout, top to bottom:**
  1. **Club:** a `Select` fed by `courses.list` (most played first), plus a "New club…" option that reveals a name input.
  2. **Date:** a native `<input type="date">`, converted to epoch ms at local noon so it never shifts days.
  3. **Holes:** 9 or 18 (tabs). For 9 on an 18-hole Course, a Front / Back choice. Back nine is stored as Played Holes 10–18, so `summarizeHoles`' wrap (`(holeNumber − 1) % courseHoleCount`) maps it correctly with no new column.
  4. **Hole grid:** one row per Played Hole, with Par (prefilled, editable) and Strokes. A "Details" toggle reveals Putts, Fairway (hidden on par 3s) and GIR.
  5. **Running total:** "41 (+14)" updates as the user types.
  6. **Submit:** disabled while the mutation is pending. Server errors show above the button.
- **After submit:** go to `/courses` with that Club selected, so the user sees new Best Results. `/stats` refreshes through invalidation.
- **Validation:**
  - Every Played Hole needs Par 3–6 and Strokes 1–15.
  - A Club is required (existing or new name).
  - The date can't be in the future.
  - Detail fields stay optional.

## 5. Open questions for the maintainer

Each comes with a recommendation.

1. **Entry model?** Recommend **(c)** (§1). (a) duplicates ADR 0001; (b) makes entered Rounds invisible to `/courses`.
2. **Store per-hole putts, fairway and GIR on `roundHoles`?** Recommend **yes**, nullable. It's cheap now, plan 011 needs it, and `roundStats` totals are still written.
3. **Editing or deleting Rounds in the first cut?** Recommend **no**. Create only. Add delete next; it's small, since a cascade from `rounds` is a single transaction. Editing can come after.
4. **Keep the `data.json` import?** Recommend **yes**. Seed stays the bulk path, and entry is for new Rounds.
5. **`pnpm db:reset` wipes manually entered Rounds.** It drops every table and reseeds from `data.json` only. Recommend accepting this for v1 with a README warning, and adding a "export manual Rounds to JSON" follow-up before entry becomes the main path.
6. **Require Par on every Played Hole?** Recommend **yes**. `rounds.score` is NOT NULL, and prefill makes it cheap. The alternative, nullable score, ripples into `/stats`.
7. **New Clubs inline?** Recommend **yes, name only**. One Club has one Course today (glossary), so creating a Club creates its Course. Its pars come from the first Round entered there, and later Rounds prefill from it.
8. **Should entered pars for a new Course be written back to `course-pars.json`?** Recommend **no**: a runtime write to a committed file is a footgun. The "most recent Round at this Club" prefill covers it. Revisit moving pars into the database only if entry overtakes import (that would supersede ADR 0001).
9. **Which user?** Recommend the hardcoded `DEFAULT_USER_ID`, the same as `/stats` and `/courses`, until auth exists.

## 6. Build-plan skeleton

Each step stays green on typecheck, lint and tests. S ≈ ≤1h, M ≈ half a day.

| # | Step | Effort |
|---|---|---|
| 1 | Schema: `rounds.id` default, `roundHoles` putts/fairway/gir. `pnpm db:generate`, then a migration round-trip (`db:reset` → `drizzle-kit migrate` is a no-op) | S |
| 2 | Extract `resultOf(strokes, par)` from `summarizeHoles` into `course-holes.ts`, plus unit tests | S |
| 3 | `roundStatsFromHoles(holes)`, a pure function giving the `roundStats` row from Played Holes, with unit tests (counts, null detail, par-3 fairways) | S |
| 4 | `rounds.prefillPars` and its router tests (par file, then last Round, then null; 9-hole wrap; back nine) | S |
| 5 | `rounds.create` with the transaction, plus router tests (derived score, `/courses` integration, rollback, validation) | M |
| 6 | `/rounds/new` page: club/date/holes controls, hole grid, running total, submit and invalidation | M |
| 7 | Links from `/stats` and `/courses`; README note on `db:reset` wiping entered Rounds; browser check | S |

Total ≈ 1.5–2 days. Steps 2–3 can land on their own. Step 6 depends on 4–5.
