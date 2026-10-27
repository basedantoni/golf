# Plan 007: Remove wildcard CORS and fix the user router's update/delete defects

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree**. Compare the "Current state" excerpts
> below against the live files before starting; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (delete-path behavior depends on whether libsql enforces foreign keys — Step 4 verifies empirically)
- **Depends on**: plans/003-test-baseline-vitest.md (test infra: `createTestDb`, caller pattern)
- **Category**: security
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The tRPC route handler sets `Access-Control-Allow-Origin: *` on every
response, including mutations — any website can call `user.delete` from a
visitor's browser. There is no auth anywhere (every procedure is
`publicProcedure`, the user ID is hardcoded), so for local dev this is moot,
but it must not survive to a deploy, and no code in this repo consumes the API
cross-origin — the headers serve nothing today. Separately, the user router
has three defects: `update` casts an optional `id` with `as string` (an
update without `id` reaches drizzle as `eq(users.id, undefined)` and throws at
runtime) and lets the caller overwrite `id` itself; `delete` wraps a
**non-awaited** promise in try/catch, so the catch can never fire; and
deleting a user who has rounds either violates the FK (error) or silently
orphans rows depending on whether the SQLite connection enforces foreign keys
(off by default in SQLite).

## Current state

- `src/app/api/trpc/[trpc]/route.ts:9-22` — the CORS block:
  ```ts
  const setCorsHeaders = (res: Response) => {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Request-Method', '*');
    res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.headers.set('Access-Control-Allow-Headers', '*');
  };

  export const OPTIONS = () => { ... setCorsHeaders(response); ... };
  ```
  plus `setCorsHeaders(response)` at line 35 in the handler.
- `src/lib/trpc/router/user.ts:18-36`:
  ```ts
  update: publicProcedure.input(updateUserSchema).mutation(({ ctx, input }) => {
    return ctx.db
      .update(users)
      .set(input)
      .where(eq(users.id, input.id as string));
  }),
  delete: publicProcedure.input(userIdSchema).mutation(({ ctx, input }) => {
    console.log('deleting user', input);
    console.log('users', users.id);
    try {
      return ctx.db.delete(users).where(eq(users.id, input.id));
    } catch (error) {
      console.error('Error deleting user', error);
      throw new TRPCError({ ... });
    }
  }),
  ```
- `src/lib/db/schema.ts:26-27` — `updateUserSchema = createUpdateSchema(users)`
  (drizzle-zod; ALL fields optional, including `id`). `userIdSchema` is
  `selectUserSchema.pick({ id: true })` (id required).
- `src/lib/db/schema.ts:51-53` — `rounds.userId` references `users.id` with
  **no `onDelete` behavior** declared.
- `src/lib/db/index.ts` — the client is created with no PRAGMA setup:
  ```ts
  const client = createClient({ url: process.env.DATABASE_URL! });
  export const db = drizzle({ client });
  ```
- Only consumer of these mutations: `src/app/_components/user/user-list.tsx`
  (delete button per user; passes `{ id }`). Nothing calls `update` yet.
- `TRPCError` is already imported in `user.ts`.
- Test infra from plan 003: `createTestDb()` in `src/lib/db/test-helpers.ts`,
  caller via `createCaller({ db } as never)` from `@/lib/trpc`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Tests     | `pnpm test`      | all pass            |
| Typecheck | `pnpm typecheck` | exit 0              |
| Lint      | `pnpm lint`      | exit 0              |
| Manual    | `pnpm dev`, open http://localhost:3000 | user list renders; delete works or 409s cleanly |

## Scope

**In scope**:
- `src/app/api/trpc/[trpc]/route.ts`
- `src/lib/trpc/router/user.ts`
- `src/lib/db/index.ts` (PRAGMA only, and only if Step 4 proves it needed)
- `src/lib/trpc/router/user.test.ts` (create)

**Out of scope**:
- Adding authentication (real fix for API exposure; tracked as direction item
  D in the audit — needs a product decision on provider).
- Schema/migration changes (`onDelete: 'cascade'` is a product decision:
  should deleting a user destroy their rounds? Deferred — see Maintenance).
- `user-list.tsx` UI changes beyond none — it already sends the right shape.

## Git workflow

- Branch: `advisor/007-harden-api-and-user-router`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the CORS layer

In `route.ts`: delete `setCorsHeaders`, the `OPTIONS` export, and the
`setCorsHeaders(response)` call. The handler becomes: build response via
`fetchRequestHandler`, return it. Keep the `onError` logging.

Rationale to preserve in a short comment is NOT needed — same-origin apps need
no CORS headers at all; the Next.js frontend and the API share an origin.

**Verify**: `pnpm typecheck` → exit 0; `pnpm dev` → home page user list still
loads (proves same-origin fetches don't need the headers).

### Step 2: Fix `update`

```ts
update: publicProcedure
  .input(updateUserSchema.required({ id: true }))
  .mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.db.update(users).set(data).where(eq(users.id, id));
  }),
```

`id` is now required by the schema (no cast), and it is stripped from the
`set` payload so callers cannot rewrite primary keys.

**Verify**: `pnpm typecheck` → exit 0 (the `.required()` call exists on
drizzle-zod v0.8 schemas since they are zod objects; if it doesn't typecheck,
use `updateUserSchema.extend({ id: z.string() })` and import `z`).

### Step 3: Fix `delete`

```ts
delete: publicProcedure.input(userIdSchema).mutation(async ({ ctx, input }) => {
  try {
    return await ctx.db.delete(users).where(eq(users.id, input.id));
  } catch (error) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Cannot delete user: user has existing rounds',
      cause: error,
    });
  }
}),
```

Changes: `async` + `await` (so the catch actually catches), both debug
`console.log` lines deleted, error code `CONFLICT` (the realistic failure is
the FK constraint).

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 4: Determine FK enforcement empirically, and enable it if off

Write `src/lib/trpc/router/user.test.ts` (pattern: plan 003's
`stats.test.ts`). Fixture: one user with one club and one round (plus its
`roundStats` row is not required for this test). Then:

```ts
await expect(caller.user.delete({ id: userA.id })).rejects.toThrow();
// and: the user must still exist afterwards
```

Two possible outcomes:

- **Test passes** → FKs are enforced on this connection; done.
- **Delete succeeds and orphans the round** → FKs are OFF. Then add to
  `src/lib/db/index.ts`, immediately after `createClient`:
  ```ts
  void client.execute('PRAGMA foreign_keys = ON');
  ```
  and mirror the same line in `createTestDb()` is NOT needed if you instead
  put the PRAGMA where both paths share it — they don't share a factory, so
  also add it to `src/lib/db/test-helpers.ts` after its `createClient` (this
  one-line touch of a plan-003 file is authorized). Re-run the test.

Additional cases in the same file:

- deleting a user with no rounds succeeds and removes the row;
- `update` changes `name` and leaves `id`/`email` intact;
- `update` without `id` is rejected by input validation
  (`rejects.toThrow()` — zod error, use `// @ts-expect-error` on the call).

**Verify**: `pnpm test` → all pass.

### Step 5: Manual smoke

`pnpm dev` → `http://localhost:3000`. Click Delete on the seeded user (who
has 95 rounds): the request must fail cleanly (CONFLICT in the network tab,
list unchanged) — not delete the user while orphaning rounds.

**Verify**: user still listed after clicking Delete; no unhandled error page.

## Test plan

Covered in Step 4: FK-protected delete, clean delete, update happy path,
update-without-id rejected. Model the file on `stats.test.ts` from plan 003.

## Done criteria

- [ ] `pnpm test` exits 0 including the new `user.test.ts`
- [ ] `pnpm typecheck` and `pnpm lint` exit 0
- [ ] `grep -n "Access-Control" src/` → no matches
- [ ] `grep -n "as string" src/lib/trpc/router/user.ts` → no matches
- [ ] `grep -cn "console.log" src/lib/trpc/router/user.ts` → 0
- [ ] Manual smoke (Step 5) behaves as described
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- An external (non-same-origin) consumer of `/api/trpc` exists that the
  operator knows about — removing CORS would break it. (Nothing in this repo
  suggests one; ask only if the operator flagged it.)
- The PRAGMA in Step 4 does not stick (libsql pools connections and the
  pragma applies per-connection) — deletes still orphan rows after adding it.
  That means FK integrity needs a different mechanism (e.g. explicit existence
  check before delete); report rather than picking one.
- `updateUserSchema.required({ id: true })` AND the `.extend` fallback both
  fail to typecheck.

## Maintenance notes

- Open product decision, deliberately deferred: should user deletion cascade
  (destroy rounds/stats/holes) or stay blocked? Cascade needs a schema
  migration (`onDelete: 'cascade'` on 4 FKs) — pair it with plan 009's schema
  work if chosen.
- When auth lands (direction item D), revisit the route handler: the
  `x-trpc-source` logging in `context.ts` (removed by plan 008) is where a
  session would be read.
- If a separate mobile/native client ever consumes this API, reintroduce CORS
  with an explicit origin allowlist from env — never `*` alongside mutations.
