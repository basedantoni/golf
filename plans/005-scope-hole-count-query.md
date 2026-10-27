# Plan 005: Replace the unbounded hole-count pre-query with a SQL subquery

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree**. Plan 004 changes only a comment in
> this file — expected drift. Compare the "Current state" excerpt against the
> live code; on any other mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (behavior covered by plan 003's characterization tests)
- **Depends on**: plans/003-test-baseline-vitest.md
- **Category**: perf
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

When `holeCountFilter` is `'9'` or `'18'`, `getRoundStats` first runs a
separate query that groups **the entire `round_holes` table across all users**
(no `WHERE` clause at all), materializes every matching round ID into a
JavaScript array, and feeds that array into `inArray(...)`. Three costs: a
full-table scan not scoped to the requesting user, an extra DB roundtrip, and
— at scale — an `inArray` parameter list that exceeds SQLite's bound-variable
limit (~32k) and throws. The fix is one uncorrelated SQL subquery: drizzle's
`inArray` accepts a query builder directly, so the whole thing collapses into
a single statement and the early-return special case disappears.

## Current state

- `src/lib/trpc/router/stats.ts:48-70`:
  ```ts
  // Handle hole count filter
  if (holeCountFilter && holeCountFilter !== 'all') {
    const targetHoleCount = parseInt(holeCountFilter, 10);

    // Subquery to get round IDs with the specified hole count
    const roundIdsWithHoleCount = await ctx.db
      .select({
        roundId: roundHoles.roundId,
        holeCount: sql<number>`count(*)`.as('holeCount')
      })
      .from(roundHoles)
      .groupBy(roundHoles.roundId)
      .having(sql`count(*) = ${targetHoleCount}`);

    const filteredRoundIds = roundIdsWithHoleCount.map(r => r.roundId);

    // If no rounds match the hole count, return empty array
    if (filteredRoundIds.length === 0) {
      return [];
    }

    conditions.push(inArray(rounds.id, filteredRoundIds));
  }
  ```
- Imports already available in the file: `eq, and, gte, lte, notInArray, desc,
  sql, inArray` from `drizzle-orm`; tables `rounds, roundStats, clubs,
  roundHoles` from `@/lib/db/schema`.
- The outer query is already scoped by `eq(rounds.userId, userId)` (line 32),
  so the subquery does not need user scoping for **correctness** — only the
  main query's conditions intersect it.
- Index `idx_round_holes_round_id` exists on `round_holes(round_id)`
  (`src/lib/db/schema.ts:86`), which serves the GROUP BY.
- Plan 003's tests in `src/lib/trpc/router/stats.test.ts` cover: `'9'` returns
  only 9-hole rounds, `'18'` only 18-hole, `'all'` returns everything, no-match
  returns `[]`. Those tests must pass unchanged.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Tests     | `pnpm test`      | all pass            |
| Typecheck | `pnpm typecheck` | exit 0              |
| Lint      | `pnpm lint`      | exit 0              |

## Scope

**In scope**:
- `src/lib/trpc/router/stats.ts` (the `holeCountFilter` block only)

**Out of scope**:
- `src/lib/trpc/router/stats.test.ts` — the point is the existing tests pass
  WITHOUT modification. Only touch it if adding the optional extra case below.
- Any other filter logic, the select list, ordering, or limit handling.
- Schema/migrations.

## Git workflow

- Branch: `advisor/005-scope-hole-count-query`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the block with a subquery condition

Replace the entire block quoted in "Current state" with:

```ts
// Handle hole count filter — uncorrelated subquery, single statement
if (holeCountFilter && holeCountFilter !== 'all') {
  const targetHoleCount = parseInt(holeCountFilter, 10);

  const roundIdsWithHoleCount = ctx.db
    .select({ roundId: roundHoles.roundId })
    .from(roundHoles)
    .groupBy(roundHoles.roundId)
    .having(sql`count(*) = ${targetHoleCount}`);

  conditions.push(inArray(rounds.id, roundIdsWithHoleCount));
}
```

Key differences: no `await`, no `.map`, no early `return []` (an empty
subquery result naturally yields zero rows from the main query), and the
subquery selects a **single column** (required for `IN (subquery)`).

**Verify**: `pnpm typecheck` → exit 0. If `inArray` rejects the subquery type,
see STOP conditions — do not fall back to the materialized-array version.

### Step 2: Run the characterization tests

**Verify**: `pnpm test` → all pass, specifically the `holeCountFilter` cases
(`'9'`, `'18'`, `'all'`, no-match → `[]`).

### Step 3 (optional, if quick): assert single-statement behavior

If plan 003's test fixtures make it easy, add one case: a round with 9 holes
belonging to user B must not affect user A's `'9'` results (already implied by
the userId-scoping test, but explicit is better). Skip if fixtures don't
support it in a few lines.

**Verify**: `pnpm test` → all pass.

## Test plan

Existing tests from plan 003 are the safety net; they must pass unmodified.
Optional new case per Step 3.

## Done criteria

- [ ] `pnpm test` exits 0 with the plan-003 hole-count cases unmodified
- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] The `holeCountFilter` block contains no `await` and no early `return`
      (`grep -n "filteredRoundIds" src/lib/trpc/router/stats.ts` → no matches)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The installed drizzle-orm version's `inArray` does not accept a subquery
  (typecheck error at `inArray(rounds.id, roundIdsWithHoleCount)`). Report the
  drizzle version and the error; the alternative (a raw
  `sql\`${rounds.id} IN (select ...)\`` fragment) needs human sign-off.
- Any plan-003 hole-count test fails after the change.

## Maintenance notes

- If per-user hole-count queries become hot at real scale, add user scoping
  inside the subquery via a join to `rounds` — deferred because the outer
  `WHERE` already bounds the result and current data is one user.
- Reviewer should confirm: subquery selects exactly one column, and the
  `return []` special case is gone (it was masking the empty-`inArray` SQL
  error).
