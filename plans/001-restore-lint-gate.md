# Plan 001: Restore a working lint gate and add a typecheck script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: This plan was written against commit `b482f63`
> **plus an uncommitted working tree** (the stats feature was not yet
> committed), so `git diff` against the SHA is not reliable. Instead, compare
> the "Current state" excerpts below against the live files before starting;
> on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `b482f63`, 2026-07-01

## Why this matters

The repo was upgraded to Next.js 16 (`next: 16.2.9`), which removed the
`next lint` command. The `lint` script in `package.json` therefore fails
immediately with `Invalid project directory provided, no such directory:
/Users/anthony/dev/golf/lint`. There is currently **no working lint gate and no
typecheck script** — the only verification available is manually running
`npx tsc --noEmit`. Every other plan in `plans/` uses `pnpm lint` and
`pnpm typecheck` as verification gates, so this plan must land first.

## Current state

- `package.json:15` — the broken script:
  ```json
  "lint": "next lint"
  ```
- `eslint.config.mjs` — a flat config already exists and is compatible with
  the ESLint 9 CLI:
  ```js
  const eslintConfig = [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
  ];
  ```
- Dev deps already present: `eslint: ^9`, `eslint-config-next: 16.0.3`,
  `typescript: ^5`. Nothing needs installing.
- `npx tsc --noEmit` currently exits 0.
- Known existing violations the ESLint CLI will surface once it runs
  (verified by reading the code):
  - `src/app/stats/_components/stats-filters.tsx:54` — `const { getPresetDateRange } = require('@/lib/utils/stats');` inside a callback → `@typescript-eslint/no-require-imports`.
  - `src/lib/db/seed.ts:24` — `.map((club: any) => ...)` → `@typescript-eslint/no-explicit-any`.
  - There may be a handful of others (unused vars, etc.); the exact set is
    unknown until the CLI runs.

## Commands you will need

| Purpose   | Command           | Expected on success |
|-----------|-------------------|---------------------|
| Install   | `pnpm install`    | exit 0              |
| Typecheck | `npx tsc --noEmit`| exit 0, no output   |
| Lint      | `pnpm lint`       | exit 0 (after this plan) |

## Scope

**In scope** (the only files you should modify):
- `package.json` (scripts only)
- `eslint.config.mjs` (ignores only)
- Source files with lint violations, **minimal mechanical fixes only** (see Step 3)

**Out of scope**:
- Adding new ESLint rules or plugins.
- Prettier / formatting setup.
- Any behavioral change to fix a violation — if a violation cannot be fixed
  mechanically (see Step 3), suppress it with a line-level
  `// eslint-disable-next-line <rule>` and note it in your report.

## Git workflow

- Branch: `advisor/001-restore-lint-gate`
- Repo history is short with plain lowercase messages (`upgrade Next js 15 -> 16`); match that style.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the lint script and add typecheck

In `package.json`, change:

```json
"lint": "next lint"
```

to:

```json
"lint": "eslint .",
"typecheck": "tsc --noEmit"
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Add ignores to the flat config

`next lint` used to ignore build output automatically; the raw ESLint CLI does
not. In `eslint.config.mjs`, add an ignores entry as the first array element:

```js
const eslintConfig = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

(`node_modules` is ignored by ESLint 9 by default.)

**Verify**: `pnpm lint` → runs to completion (exit code may be non-zero due to
pre-existing violations; it must NOT error with a config/crash message, and it
must NOT report any file under `.next/`).

### Step 3: Fix surfaced violations mechanically

Run `pnpm lint` and fix each reported violation with the smallest possible
change:

- `src/app/stats/_components/stats-filters.tsx` — delete the inline
  `require(...)` line and add `import { getPresetDateRange } from '@/lib/utils/stats';`
  at the top of the file with the other imports. The callback body then uses
  the imported function directly. (Plan 004 rewrites this callback further;
  this mechanical fix does not conflict with it.)
- `src/lib/db/seed.ts:24` — replace `(club: any)` with
  `(club: { clubId: string; name: string })` (that is the shape used two lines
  below).
- Unused variables/imports: delete them.
- Anything that would require restructuring logic: add
  `// eslint-disable-next-line <rule>` instead, and list it in your report.

**Verify**: `pnpm lint` → exit 0. `pnpm typecheck` → exit 0.

## Test plan

No test runner exists yet (plan 003 introduces one). Verification for this
plan is the lint and typecheck commands themselves.

## Done criteria

- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `grep -n '"lint"' package.json` shows `eslint .`, not `next lint`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm lint` reports more than ~15 violations — the repo has drifted and a
  human should triage.
- Any violation fix would change runtime behavior (other than the two known
  fixes listed in Step 3).
- ESLint crashes with a config error after Step 2 (flat-config/`FlatCompat`
  incompatibility) — report the exact error instead of swapping config styles.

## Maintenance notes

- Plans 002–008 all use `pnpm lint` / `pnpm typecheck` as gates; if either
  script is renamed, update those plans.
- A future CI workflow (none exists today) should run exactly these two
  scripts plus `pnpm test` (added by plan 003).
