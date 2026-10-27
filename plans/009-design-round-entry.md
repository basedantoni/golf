# Plan 009: Design spike — round entry (create rounds in the app)

> **Executor instructions**: This is a **design spike, not a build plan**. The
> deliverable is a design document, not production code. Investigate, decide
> what you can, and surface what needs the maintainer's call. If anything in
> "STOP conditions" occurs, stop and report. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: Written against commit `b482f63` plus an
> uncommitted working tree. Verify the schema excerpts below against
> `src/lib/db/schema.ts` before designing on top of them.

## Status

- **Priority**: P3
- **Effort**: M (spike only; the build it specifies is L)
- **Risk**: LOW (no production code)
- **Depends on**: none (reads only); the resulting build plan will depend on 003
- **Category**: direction
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The app is currently **read-only**: rounds exist only via `pnpm db:seed` from
a personal `data.json` export. There is no mutation anywhere that creates a
round — the schema, stats pipeline, and dashboard are fully built, but the
only write path is a seed script. Until a round can be entered in the app,
this is a viewer for one JSON file, not a product. This spike produces the
design for the write path.

## Current state (facts to design against)

- Schema (`src/lib/db/schema.ts`): `rounds` (id, userId, clubId, timestamp
  **epoch ms**, score, strokes), `roundHoles` (roundId, holeNumber, strokes;
  PK roundId+holeNumber), `roundStats` (roundId PK + ~24 stat columns:
  scoring counts, fairway dispersion, GIR dispersion, putts, stroke gain),
  `roundRecommendedStats` (typed key/value per round), `clubs` (id, name).
- **Critical schema gap**: there is NO course/hole-par data anywhere. `rounds`
  has `score` AND `strokes` as independent integers, and `roundStats` has
  birdies/pars/bogeys counts — all of which are **derivable only if hole pars
  are known**. In `data.json` these arrive precomputed from the exporting app.
  For in-app entry, either the user enters pars (per course, once) or enters
  the derived stats manually. This is the central design decision.
- Existing form stack (already in `package.json`, currently unused for any
  form): `react-hook-form ^7.56`, `@hookform/resolvers ^5`, `zod ^3.25`, and
  `src/components/ui/form.tsx` (shadcn form primitives wrapping RHF).
- Mutation conventions: see `src/lib/trpc/router/user.ts` — zod input schema
  from drizzle-zod (`createInsertSchema`), `publicProcedure.mutation`,
  drizzle inserts. There is currently no multi-table transaction anywhere;
  drizzle's libsql driver supports `db.transaction(async (tx) => ...)` —
  verify against the installed drizzle version during the spike.
- Client mutation pattern: `src/app/_components/user/user-list.tsx` —
  `useMutation(trpc.user.X.mutationOptions({ onSuccess: invalidate }))`.
- IDs: `data.json` rounds use UUIDs from the source app; `users.id` defaults
  to `nanoid()`. New rounds should use the repo's existing `nanoid` default
  pattern (`$defaultFn(() => nanoid())` — note `rounds.id` currently has NO
  default; the design should add one).
- Seeded reality: 95 rounds, 75 are 9-hole; timestamps epoch ms.

## Deliverable

Write `plans/design-round-entry.md` containing:

1. **Data-entry model decision** (recommend one, with trade-offs):
   - (a) *Hole-by-hole entry with course pars*: add a `courseHoles` table
     (clubId, holeNumber, par); user defines a course's pars once; strokes per
     hole entered per round; score/birdies/pars/etc. all derived. Most work,
     best data.
   - (b) *Summary entry*: user types totals (score, strokes, putts, fairways
     hit...) directly into `roundStats`-shaped fields. Least work, no per-hole
     data, stats like GIR dispersion entered manually or skipped.
   - (c) Hybrid: hole-by-hole strokes + optional per-hole detail, pars
     optional (stats degrade gracefully to null, which the schema/UI already
     tolerate — every `roundStats` column is nullable-with-default and the
     dashboard null-guards all derived metrics).
2. **Schema changes**: exact drizzle table/column additions (incl. default for
   `rounds.id`, any `courseHoles` table), and the migration story
   (`pnpm db:generate`).
3. **API design**: `roundsRouter` procedures with zod input schemas spelled
   out (`createRound` at minimum; transaction boundaries across
   rounds/roundHoles/roundStats writes; how derived fields are computed
   server-side).
4. **UI design**: route (`/rounds/new`), form structure using the existing
   RHF + zod + shadcn `form.tsx` stack, validation rules (hole strokes 1–15,
   9 or 18 holes, club required — reuse `getClubs`), and post-submit
   navigation/invalidation.
5. **Open questions for the maintainer** — each with a recommendation:
   at minimum the entry-model choice, whether editing/deleting rounds is in
   the first cut, and whether `data.json` import remains a supported path
   alongside manual entry (recommended: yes, seed stays).
6. **Build-plan skeleton**: ordered step list sized for a future executor
   plan (or plans), with effort estimate per step.

## Investigation steps

1. Read `src/lib/db/schema.ts`, `seed.ts`, `router/stats.ts`,
   `router/user.ts`, `user-list.tsx`, `components/ui/form.tsx`.
2. Inspect `data.json` semantics: confirm what `score` means (compare `score`
   vs `strokes` vs sum of `holeStrokes` for a few rounds — e.g. is `score`
   relative-to-par?). Record findings; the design depends on them.
3. Verify `db.transaction` works with the installed drizzle-orm + libsql
   driver (check drizzle docs/changelog for the installed version — read-only
   check, no code committed).
4. Write the deliverable document.

## Suggested executor toolkit

- The `react-hook-form-zod` skill (if available in your environment) for the
  form-design section.
- Drizzle docs for libsql transactions.

## Scope

**In scope**: creating `plans/design-round-entry.md`. Reading anything.
**Out of scope**: ANY production code, schema, or migration change. No
prototype commits.

## Done criteria

- [ ] `plans/design-round-entry.md` exists and covers all 6 deliverable sections
- [ ] The `score` semantics question is answered with evidence from `data.json`
      (or explicitly listed as unresolvable from data + flagged)
- [ ] Every open question has a recommendation attached
- [ ] No production files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `data.json` is absent (the maintainer may have moved it) — the semantics
  investigation needs it; report instead of guessing.

## Maintenance notes

- Plan 011 (per-hole view) consumes the same par-data decision — whichever
  spike runs first should record the decision where the other can find it
  (this file's design doc is the place).
