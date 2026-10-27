# Plan 008: Delete dead code and debug logs; fix onboarding docs and gitignore

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree**. Plans 004/006/007 touch some of the
> same files (`stats-dashboard.tsx`, `user.ts`) — if the specific lines this
> plan deletes are already gone, skip that sub-step and note it. Any other
> mismatch with "Current state": STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (cleaner after 004–007; safe anytime)
- **Category**: tech-debt / dx
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

Four small messes with outsized daily cost. (1) `stats.getSummaryStats` is a
dead stub that returns `null` — a trap for any client developer who finds it
in the typed API surface. (2) Debug `console.log`s fire on every tRPC request
and every dashboard render. (3) A fresh clone cannot run the app: the seed
script hard-requires an untracked `data.json` the README never mentions, the
README's install instructions say npm/yarn while the repo is pnpm-locked, and
`data.json` contains real PII (name, email, user ID) with **no gitignore
entry protecting it from an accidental commit**. (4) A stray empty
`.db.sqlite` sits in the repo root, also unignored (`.gitignore` has `*.db`
but not `*.sqlite`).

## Current state

- `src/lib/trpc/router/stats.ts:162-170` — the dead stub:
  ```ts
  // Get summary/aggregate stats for the filtered data
  getSummaryStats: publicProcedure
    .input(statsFilterSchema)
    .query(async ({ ctx, input }) => {
      // This reuses the getRoundStats logic internally
      // For now, we'll calculate aggregates on the client
      // This procedure could be expanded for server-side aggregation
      return null;
    }),
  ```
  Verified unused: `grep -rn "getSummaryStats" src/` matches only this
  definition. (Client aggregation in `calculateAggregates` is the chosen
  approach and is fine at this scale.)
- `src/lib/trpc/context.ts:18-21` — logs every request:
  ```ts
  export const createTRPCContext = async (opts: { headers: Headers }) => {
    const source = opts.headers.get('x-trpc-source') ?? 'unknown';
    console.log(`>>> tRPC Request from: ${source}`);
  ```
- `src/app/stats/_components/stats-dashboard.tsx:98` —
  `console.log("Putts Chart Data", puttsChartData);` (plan 006 may have
  removed it already).
- `src/lib/trpc/router/user.ts:25-26` — two debug logs (plan 007 removes
  them; skip if gone).
- Keep: `console.error` in `route.ts` `onError` and the console output in
  `seed.ts`/`reset.ts` (CLI scripts — logging is their UI).
- `.gitignore` — ends with `*.db`; no `*.sqlite`, no `data.json` entry.
- Repo root: `.db.sqlite` (0 bytes, untracked, stray), `local.db` (the real
  dev DB, ignored via `*.db`), `data.json` (95 rounds of real personal golf
  data + PII, untracked, required by `src/lib/db/seed.ts:19-20`:
  `join(process.cwd(), 'data.json')`).
- `README.md` — generic Next.js starter text: npm/yarn/bun install variants,
  `cp .env.example .env`, `pnpm db:generate && pnpm db:migrate`. Missing
  entirely: pnpm being the required package manager (lockfile +
  `pnpm-workspace.yaml`), `data.json` requirement and shape, `db:seed` /
  `db:reset` scripts, the `/stats` page.
- `.env.example` exists (13 bytes; `DATABASE_URL` pointing at a local file).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|---------------------|
| Tests     | `pnpm test`      | all pass (if plan 003 landed) |
| Typecheck | `pnpm typecheck` | exit 0              |
| Lint      | `pnpm lint`      | exit 0              |
| Fresh-clone dry run | see Step 5 | documented failure mode |

## Scope

**In scope**:
- `src/lib/trpc/router/stats.ts` (remove `getSummaryStats` only)
- `src/lib/trpc/context.ts` (remove the two logging lines)
- `src/app/stats/_components/stats-dashboard.tsx` (remove the console.log, if present)
- `src/lib/trpc/router/user.ts` (remove debug logs, if still present)
- `.gitignore`
- `README.md`
- Delete file: `.db.sqlite` (repo root; verify it is 0 bytes first)

**Out of scope**:
- `data.json` itself — do NOT commit it, do NOT modify it, do NOT delete it.
- `CHANGELOG.md`, `thoughts/` — untracked working notes; leave untouched.
- `seed.ts`/`reset.ts` console output.
- Committing `local.db` or any database file.

## Git workflow

- Branch: `advisor/008-cleanup-and-onboarding`
- Plain lowercase commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the dead procedure

Delete the `getSummaryStats` block from `src/lib/trpc/router/stats.ts`
(lines 162–170 in current state, including its comment). If the `input`
variable or any import becomes unused as a result, remove that too (expected:
nothing else is affected — `statsFilterSchema` is still used by
`getRoundStats`).

**Verify**: `pnpm typecheck` → exit 0;
`grep -rn "getSummaryStats" src/` → no matches.

### Step 2: Remove debug logging

- `context.ts`: delete the `const source = ...` and `console.log(...)` lines.
  The function body becomes just `return { db };`. Keep the JSDoc.
- `stats-dashboard.tsx:98`: delete the `console.log` line (skip if plan 006
  removed it).
- `user.ts:25-26`: delete both `console.log` lines (skip if plan 007 landed).

**Verify**:
`grep -rn "console.log" src/ --include='*.ts' --include='*.tsx' | grep -v db/seed.ts | grep -v db/reset.ts` → no matches.

### Step 3: Fix .gitignore and delete the stray file

Verify then delete: `ls -la .db.sqlite` must show 0 bytes → `rm .db.sqlite`.
If it is NOT empty, STOP (someone put data in it).

Append to `.gitignore`:

```
*.sqlite
*.sqlite3

# personal seed data (contains PII) — required locally by db:seed, never commit
data.json
```

**Verify**: `git check-ignore data.json .db.sqlite local.db` → all three paths
print (ignored). `git status` no longer lists `.db.sqlite` or `data.json`.

### Step 4: Rewrite the README

Replace `README.md` with accurate content. Required sections (keep it short;
prose can be adapted, facts cannot):

1. **What this is** — golf statistics dashboard: Next.js 16 (App Router) +
   tRPC v11 + Drizzle/libsql (SQLite) + shadcn/Radix UI + Recharts. Main page:
   `/stats`.
2. **Prerequisites** — Node, **pnpm** (the only supported package manager:
   `pnpm-lock.yaml` + `pnpm-workspace.yaml` overrides are pnpm-specific).
3. **Setup** —
   ```bash
   pnpm install
   cp .env.example .env        # sets DATABASE_URL (local SQLite file)
   # place your data export at ./data.json (see below) — required for seeding
   pnpm db:reset               # drop + migrate + seed in one step
   pnpm dev
   ```
4. **data.json** — untracked on purpose (contains personal data). Shape the
   seed expects (top-level keys): `accountData` (`userId`, `userName`,
   `birthYear`, `email`), `clubData` (`playedClubs[]`, `followedClubs[]`,
   `postedInClubs[]`, each with `clubId`, `name`), `activityData.rounds[]`
   (`id`, `timestamp` in **epoch ms**, `clubId.id`, `score`, `strokes`,
   `holeStrokes[]`, `stats{...}` incl. `recommendedStats[]`).
5. **Scripts** — table of all `package.json` scripts with one-line purposes
   (`dev`, `build`, `start`, `lint`, `typecheck`, `test` if plan 003 landed,
   `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `db:studio`, `clean`).
6. **Note** — the app currently serves a single hardcoded user
   (`src/app/stats/page.tsx`); auth is future work.

**Verify**: every command named in the README exists in `package.json`
scripts (`grep` each); no npm/yarn/bun instructions remain.

### Step 5: Full gate + fresh-clone sanity

Run `pnpm typecheck`, `pnpm lint`, and (if present) `pnpm test` → all exit 0.
Then sanity-check the documented flow end-to-end in place:
`pnpm db:reset` → completes with seed output "✅ Seeded 95 rounds" (or
current count); `pnpm dev` → `/stats` renders data.

**Verify**: as stated per command.

## Test plan

No new tests — deletions and docs. Existing suite (plan 003) must stay green;
`stats.test.ts` does not cover `getSummaryStats` by design.

## Done criteria

- [ ] `grep -rn "getSummaryStats" src/` → no matches
- [ ] The Step 2 console.log grep → no matches
- [ ] `git check-ignore data.json` → path printed; `.db.sqlite` deleted
- [ ] README contains no `npm install`/`yarn`/`bun` instructions and documents
      `data.json` and `db:reset`
- [ ] `pnpm typecheck`, `pnpm lint` (and `pnpm test` if present) exit 0
- [ ] `pnpm db:reset` completes and `/stats` renders
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -rn "getSummaryStats" src/` finds a caller (drift — someone started
  using the stub).
- `.db.sqlite` is non-empty.
- `pnpm db:reset` fails — the reset/seed path has its own assumptions
  (`DATABASE_URL`, `data.json` shape); report the exact error rather than
  patching seed code (out of scope).

## Maintenance notes

- If server-side aggregation is ever actually needed (thousands of rounds),
  reintroduce it as a fresh procedure with real SQL aggregates — don't
  resurrect the stub pattern.
- A `data.json.example` with faked data (faker is already a devDep) would make
  onboarding fully self-contained — deferred as optional follow-up.
- When auth lands, the README's "single hardcoded user" note comes out.
