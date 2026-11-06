# Golf Stats

Personal golf statistics dashboard built from a scoring-app data export.

- **Stack**: Next.js 16 (App Router) + tRPC v11 + Drizzle ORM on libsql (SQLite) + shadcn/Radix UI + Recharts.
- **Pages**: `/stats` (trends and summary stats with filters), `/courses` (best result per Hole on each Course).
- **Vocabulary**: see [`GLOSSARY.md`](GLOSSARY.md). Decisions: [`docs/adr/`](docs/adr/).

## Prerequisites

- Node.js
- **pnpm**. It's the only supported package manager: `pnpm-lock.yaml` and the overrides in `pnpm-workspace.yaml` are pnpm-specific.

## Setup

```bash
pnpm install
cp .env.example .env        # then set DATABASE_URL, e.g. DATABASE_URL=file:./local.db
# place your data export at ./data.json (see below) — required for seeding
pnpm db:reset               # drop all tables, run migrations, seed from data.json
pnpm dev                    # http://localhost:3000/stats
```

## data.json

The seed reads `./data.json`, the scoring-app export. It is **git-ignored on purpose**: it contains personal data (name, email, round history). Never commit it.

Top-level keys the seed uses:

- `accountData`: `userId`, `userName`, `birthYear`, `email`
- `clubData`: `playedClubs[]`, `followedClubs[]`, `postedInClubs[]`, each `{ clubId, name }`
- `activityData.rounds[]`: `id`, `timestamp` (**epoch ms**), `clubId.id`, `score`, `strokes`, `holeStrokes[]`, `stats{...}` including `recommendedStats[]`

The export has no per-hole par. Par for each Hole comes from [`src/lib/db/course-pars.json`](src/lib/db/course-pars.json) (see [ADR 0001](docs/adr/0001-par-on-played-hole.md)). A Course missing from that file seeds with Par Unknown holes. To propose pars for a new Course from its Rounds, run `pnpm tsx src/lib/db/solve-pars.ts`, then check the output against the scorecard.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest, single run |
| `pnpm test:watch` | Vitest, watch mode |
| `pnpm db:generate` | Generate a migration from `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:seed` | Seed from `data.json` (into an empty, migrated db) |
| `pnpm db:reset` | Drop all tables, migrate, and seed |
| `pnpm db:studio` | Drizzle Studio database browser |
| `pnpm clean` | Delete `.next` and `node_modules` |

## Notes

- The app serves a single hardcoded user (`DEFAULT_USER_ID` in `src/app/stats/page.tsx` and `src/app/courses/page.tsx`). Auth is future work.
