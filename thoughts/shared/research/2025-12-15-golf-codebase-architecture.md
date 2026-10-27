---
date: 2025-12-16T02:34:35Z
researcher: Claude
git_commit: b482f63675856a37b45f84ae9b367c5b0523411e
branch: main
repository: golf
topic: "Golf Application Codebase Architecture and Structure"
tags: [research, codebase, nextjs, trpc, drizzle, sqlite, golf, architecture]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude
---

# Research: Golf Application Codebase Architecture and Structure

**Date**: 2025-12-16T02:34:35Z
**Researcher**: Claude
**Git Commit**: b482f63675856a37b45f84ae9b367c5b0523411e
**Branch**: main
**Repository**: golf

## Research Question

Document the overall codebase structure and architecture of this golf application, including project overview, technology stack, project structure, database architecture, API/backend architecture, frontend architecture, key features, and configuration.

## Summary

This is a **Next.js MVP starter application** named "Antho MVP" designed for tracking golf rounds and statistics. The application uses a modern full-stack TypeScript architecture with tRPC for type-safe API communication, Drizzle ORM with SQLite for database operations, and shadcn/ui components for the frontend interface. The application currently implements a comprehensive golf data model supporting users, golf clubs/courses, rounds with hole-by-hole tracking, and detailed golf statistics.

---

## 1. Project Overview

### What Type of Application Is This?

This is a **Next.js 16 full-stack web application** designed as an MVP (Minimum Viable Product) starter kit. While the UI is minimal, the database schema reveals it is intended to be a **golf round tracking and statistics application**.

### Purpose

The application tracks:
- **Users** with their golf round history
- **Golf clubs/courses** where rounds are played
- **Golf rounds** with comprehensive statistics including:
  - Hole-by-hole stroke tracking
  - Scoring performance (aces, eagles, birdies, pars, bogeys, etc.)
  - Fairway accuracy statistics
  - Green in Regulation (GIR) statistics
  - Putting statistics
  - Stroke gain analysis

### Application Name

The application is named "Antho MVP" as evidenced by:
- `src/app/layout.tsx:13` - `title: 'Antho MVP'`
- `package.json:2` - `"name": "antho-mvp"`

---

## 2. Technology Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.3 | React meta-framework with App Router |
| React | 19.2.0 | UI library |
| TypeScript | ^5 | Type-safe JavaScript |

### Backend / API

| Technology | Version | Purpose |
|------------|---------|---------|
| tRPC | ^11.1.4 | End-to-end type-safe API |
| @trpc/server | ^11.1.4 | Server-side tRPC implementation |
| @trpc/client | ^11.1.4 | Client-side tRPC implementation |
| @trpc/tanstack-react-query | ^11.1.4 | React Query integration for tRPC |
| SuperJSON | ^2.2.2 | JSON serialization with type preservation |

### Database

| Technology | Version | Purpose |
|------------|---------|---------|
| Drizzle ORM | ^0.44.0 | TypeScript ORM |
| drizzle-kit | ^0.31.1 | Drizzle migration tooling |
| drizzle-zod | ^0.8.2 | Zod schema generation from Drizzle |
| @libsql/client | ^0.15.7 | LibSQL/SQLite client |
| SQLite | (local) | Local file-based database |

### Frontend UI

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | ^4 | Utility-first CSS framework |
| shadcn/ui | (components) | Radix-based UI component library |
| @radix-ui/* | various | Accessible UI primitives |
| Lucide React | ^0.511.0 | Icon library |
| class-variance-authority | ^0.7.1 | Variant styling utility |
| tailwind-merge | ^3.3.0 | Tailwind class merging |
| next-themes | ^0.4.6 | Theme switching (dark/light mode) |
| tw-animate-css | ^1.3.0 | Tailwind animations |

### Data Validation

| Technology | Version | Purpose |
|------------|---------|---------|
| Zod | ^3.25.34 | Runtime schema validation |
| react-hook-form | ^7.56.4 | Form state management |
| @hookform/resolvers | ^5.0.1 | Zod resolver for react-hook-form |

### State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| @tanstack/react-query | ^5.77.2 | Server state management |
| @tanstack/react-query-devtools | ^5.77.2 | React Query debugging tools |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| tsx | ^4.19.4 | TypeScript execution |
| ESLint | ^9 | Code linting |
| @faker-js/faker | ^9.8.0 | Test data generation (dev) |
| pnpm | (package manager) | Package management |

---

## 3. Project Structure

```
golf/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── _components/              # Private app components
│   │   │   ├── providers.tsx         # Client-side providers (Theme, tRPC)
│   │   │   └── user/
│   │   │       └── user-list.tsx     # User list component
│   │   ├── api/
│   │   │   └── trpc/
│   │   │       └── [trpc]/
│   │   │           └── route.ts      # tRPC API route handler
│   │   ├── globals.css               # Global styles with CSS variables
│   │   ├── layout.tsx                # Root layout with providers
│   │   └── page.tsx                  # Home page
│   ├── components/
│   │   └── ui/                       # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── form.tsx
│   │       ├── label.tsx
│   │       ├── scroll-area.tsx
│   │       └── separator.tsx
│   └── lib/
│       ├── db/
│       │   ├── index.ts              # Database client export
│       │   ├── schema.ts             # Drizzle schema definitions
│       │   ├── seed.ts               # Database seeding script
│       │   ├── reset.ts              # Database reset script
│       │   └── migrations/           # SQL migration files
│       │       ├── 0000_sudden_stellaris.sql
│       │       ├── 0001_reflective_the_executioner.sql
│       │       └── meta/
│       ├── trpc/
│       │   ├── index.ts              # tRPC exports and type inference
│       │   ├── context.ts            # tRPC context creation
│       │   ├── query-client.ts       # React Query client configuration
│       │   ├── react.tsx             # Client-side tRPC provider
│       │   ├── server.tsx            # Server-side tRPC utilities
│       │   └── router/
│       │       ├── _app.ts           # Root router composition
│       │       └── user.ts           # User router procedures
│       └── utils.ts                  # Utility functions (cn helper)
├── public/                           # Static assets
├── thoughts/                         # Research documentation
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Environment template
├── components.json                   # shadcn/ui configuration
├── drizzle.config.ts                 # Drizzle ORM configuration
├── eslint.config.mjs                 # ESLint configuration
├── next.config.ts                    # Next.js configuration
├── package.json                      # Project dependencies
├── postcss.config.mjs                # PostCSS configuration
├── tailwind.config.ts                # (via Tailwind v4 - inline)
├── tsconfig.json                     # TypeScript configuration
├── data.json                         # Seed data (74KB of golf data)
└── local.db                          # SQLite database file
```

### Key Directory Purposes

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js App Router pages, layouts, and API routes |
| `src/app/_components/` | Application-specific React components (prefixed with _ to prevent routing) |
| `src/components/ui/` | Reusable shadcn/ui component library |
| `src/lib/db/` | Database configuration, schema, migrations, and scripts |
| `src/lib/trpc/` | tRPC server and client configuration |
| `public/` | Static files served at root |

---

## 4. Database Architecture

### Database Technology

- **Database**: SQLite (local file: `local.db`)
- **ORM**: Drizzle ORM
- **Client**: @libsql/client

### Connection Configuration

**File**: `src/lib/db/index.ts`
```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({ url: process.env.DATABASE_URL! });
export const db = drizzle({ client });
```

### Database Schema

**File**: `src/lib/db/schema.ts`

#### Table: `users`

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY, auto-generated nanoid |
| name | text | NOT NULL |
| age | int | NOT NULL |
| email | text | NOT NULL, UNIQUE |

#### Table: `clubs`

Golf clubs/courses where rounds are played.

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY |
| name | text | NOT NULL |

#### Table: `rounds`

Individual golf rounds played.

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PRIMARY KEY |
| user_id | text | NOT NULL, FK -> users.id |
| club_id | text | NOT NULL, FK -> clubs.id |
| timestamp | integer | NOT NULL |
| score | integer | NOT NULL |
| strokes | integer | NOT NULL |

**Indexes**: `idx_rounds_user_id`, `idx_rounds_club_id`, `idx_rounds_timestamp`

#### Table: `round_holes`

Hole-by-hole stroke data for each round.

| Column | Type | Constraints |
|--------|------|-------------|
| round_id | text | NOT NULL, FK -> rounds.id |
| hole_number | integer | NOT NULL |
| strokes | integer | NOT NULL |

**Primary Key**: Composite (round_id, hole_number)
**Indexes**: `idx_round_holes_round_id`

#### Table: `round_stats`

Comprehensive statistics for each round.

| Column | Type | Default |
|--------|------|---------|
| round_id | text | PK, FK -> rounds.id |
| aces | integer | 0 |
| double_eagle_or_better | integer | 0 |
| eagles | integer | 0 |
| birdies | integer | 0 |
| pars | integer | 0 |
| bogeys | integer | 0 |
| double_bogey_or_worse | integer | 0 |
| fairway_lefts | integer | 0 |
| fairway_middles | integer | 0 |
| fairway_rights | integer | 0 |
| fairway_shorts | integer | 0 |
| fairway_longs | integer | 0 |
| fairway_hole_count | integer | 0 |
| gir | integer | 0 |
| gir_lefts | integer | 0 |
| gir_rights | integer | 0 |
| gir_shorts | integer | 0 |
| gir_longs | integer | 0 |
| gir_no_chances | integer | 0 |
| gir_hole_count | integer | 0 |
| putts | integer | 0 |
| putt_hole_count | integer | 0 |
| stroke_gain_overall | integer | 100 |
| stroke_gain_tee_to_green | integer | 100 |

#### Table: `round_recommended_stats`

Additional recommended statistics per round.

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PRIMARY KEY AUTOINCREMENT |
| round_id | text | NOT NULL, FK -> rounds.id |
| type | text | NOT NULL |
| no_stats | integer | DEFAULT false (boolean) |
| value | real | nullable |

**Indexes**: `idx_recommended_stats_round_id`

#### Table: `user_followed_clubs`

Junction table for clubs a user follows.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | text | NOT NULL, FK -> users.id |
| club_id | text | NOT NULL, FK -> clubs.id |

**Primary Key**: Composite (user_id, club_id)

#### Table: `user_played_clubs`

Junction table for clubs a user has played at.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | text | NOT NULL, FK -> users.id |
| club_id | text | NOT NULL, FK -> clubs.id |

**Primary Key**: Composite (user_id, club_id)

#### Table: `user_posted_in_clubs`

Junction table for clubs a user has posted in.

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | text | NOT NULL, FK -> users.id |
| club_id | text | NOT NULL, FK -> clubs.id |

**Primary Key**: Composite (user_id, club_id)

### Entity Relationship Diagram

```
┌─────────────────────┐
│       users         │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ age                 │
│ email (UNIQUE)      │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐          ┌─────────────────────┐
│       rounds        │          │       clubs         │
├─────────────────────┤          ├─────────────────────┤
│ id (PK)             │  N:1     │ id (PK)             │
│ user_id (FK)        │◄────────►│ name                │
│ club_id (FK)        │          └─────────────────────┘
│ timestamp           │                    │
│ score               │                    │
│ strokes             │          ┌─────────┼─────────┐
└─────────────────────┘          │         │         │
         │                       ▼         ▼         ▼
         │ 1:N            user_followed  user_played  user_posted
         ▼                _clubs        _clubs       _in_clubs
┌─────────────────────┐   (junction)   (junction)   (junction)
│    round_holes      │
├─────────────────────┤
│ round_id (PK, FK)   │
│ hole_number (PK)    │
│ strokes             │
└─────────────────────┘
         │
         │ (same round_id)
         ▼
┌─────────────────────┐    ┌─────────────────────────┐
│    round_stats      │    │ round_recommended_stats │
├─────────────────────┤    ├─────────────────────────┤
│ round_id (PK, FK)   │    │ id (PK)                 │
│ aces, eagles, etc.  │    │ round_id (FK)           │
│ fairway stats       │    │ type                    │
│ gir stats           │    │ no_stats                │
│ putting stats       │    │ value                   │
│ stroke gain stats   │    └─────────────────────────┘
└─────────────────────┘
```

### Zod Schemas

The schema file exports Zod schemas for each table using `drizzle-zod`:
- `insertUserSchema`, `updateUserSchema`, `selectUserSchema`, `userIdSchema`
- `insertClubSchema`, `selectClubSchema`
- `insertRoundSchema`, `selectRoundSchema`
- `insertRoundHoleSchema`, `selectRoundHoleSchema`
- `insertRoundStatsSchema`, `selectRoundStatsSchema`
- `insertRoundRecommendedStatsSchema`, `selectRoundRecommendedStatsSchema`
- `insertUserFollowedClubSchema`, `insertUserPlayedClubSchema`, `insertUserPostedInClubSchema`

---

## 5. API/Backend Architecture

### tRPC Setup

The application uses tRPC v11 for end-to-end type-safe API communication.

#### Context Creation

**File**: `src/lib/trpc/context.ts`

The tRPC context provides access to the database connection:

```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const source = opts.headers.get('x-trpc-source') ?? 'unknown';
  console.log(`>>> tRPC Request from: ${source}`);
  return { db };
};
```

Key features:
- Uses SuperJSON transformer for serialization
- Custom error formatter that includes Zod validation errors
- Exports `publicProcedure` for creating API procedures

#### Router Architecture

**Root Router**: `src/lib/trpc/router/_app.ts`

```typescript
export const appRouter = createTRPCRouter({
  user: userRouter,
});
```

**User Router**: `src/lib/trpc/router/user.ts`

| Procedure | Type | Input Schema | Description |
|-----------|------|--------------|-------------|
| `user.all` | Query | none | Fetches all users |
| `user.create` | Mutation | insertUserSchema | Creates a new user |
| `user.update` | Mutation | updateUserSchema | Updates a user |
| `user.delete` | Mutation | userIdSchema | Deletes a user by ID |

#### API Route Handler

**File**: `src/app/api/trpc/[trpc]/route.ts`

The tRPC API is exposed at `/api/trpc` using Next.js App Router:
- Handles GET and POST requests
- Configures CORS headers for cross-origin access
- Error logging for debugging

### Server-Side tRPC Usage

**File**: `src/lib/trpc/server.tsx`

Provides utilities for server-side tRPC usage:
- `trpc` - Options proxy for server components
- `HydrateClient` - Component for hydrating React Query state
- `prefetch` - Function for prefetching queries in server components
- Uses React `cache()` for stable query client per request

---

## 6. Frontend Architecture

### App Router Structure

The application uses Next.js 16 App Router architecture:
- Server Components by default
- Client Components marked with `'use client'`
- Turbopack for development (`next dev --turbopack`)

### Provider Hierarchy

**File**: `src/app/layout.tsx`

```
<html>
  <body>
    <Providers>
      <ThemeProvider>          {/* next-themes */}
        <TRPCReactProvider>    {/* tRPC + React Query */}
          {children}
          <ReactQueryDevtools />  {/* Dev only */}
        </TRPCReactProvider>
      </ThemeProvider>
    </Providers>
  </body>
</html>
```

### Client-Side tRPC Provider

**File**: `src/lib/trpc/react.tsx`

Configures:
- Singleton QueryClient for browser
- HTTP batch streaming link for API calls
- Logger link for development debugging
- SuperJSON transformer

### UI Component Library

Uses shadcn/ui with "new-york" style variant.

**Configuration**: `components.json`

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

**Available Components** (`src/components/ui/`):
- `button.tsx` - Button with variants (default, destructive, outline, secondary, ghost, link)
- `form.tsx` - Form components with react-hook-form integration
- `label.tsx` - Form labels
- `scroll-area.tsx` - Scrollable container
- `separator.tsx` - Visual divider

### Styling System

**File**: `src/app/globals.css`

- Uses Tailwind CSS v4 with `@import "tailwindcss"`
- CSS custom properties for theming
- Light and dark mode support via `.dark` class
- OKLCH color space for modern color handling
- Includes chart colors for data visualization

### Path Aliases

**File**: `tsconfig.json`

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./src/app/_components/*"]
  }
}
```

---

## 7. Key Features

### Implemented Features

1. **User Management** (via tRPC)
   - List all users
   - Create new users
   - Update existing users
   - Delete users
   - Zod validation on all inputs

2. **Database Operations**
   - Drizzle ORM migrations
   - Database seeding from `data.json`
   - Database reset with `--no-seed` option

3. **Theme Support**
   - Light/dark mode via next-themes
   - System preference detection
   - CSS variable-based theming

4. **React Query Integration**
   - Optimistic updates
   - Query invalidation on mutations
   - SSR with hydration support
   - DevTools in development

### Data Model Features (Schema-Ready)

The database schema supports comprehensive golf tracking that is not yet exposed via the UI:

1. **Golf Clubs/Courses**
   - Club tracking with unique IDs
   - User relationships: followed, played, posted in

2. **Round Tracking**
   - Full round records with timestamps
   - Hole-by-hole stroke recording (18 holes)
   - Score and total strokes

3. **Golf Statistics**
   - Scoring breakdown (aces through double bogeys)
   - Fairway accuracy with directional data
   - GIR (Green in Regulation) tracking with miss direction
   - Putting statistics
   - Stroke gain analysis (overall and tee-to-green)

4. **Recommended Stats**
   - Flexible stat tracking per round
   - Supports both numeric and boolean stat types

---

## 8. Configuration

### Environment Variables

**File**: `.env.example`

```
DATABASE_URL=
```

The only required environment variable is `DATABASE_URL` which points to the SQLite database file (typically `file:local.db` for local development).

### TypeScript Configuration

**File**: `tsconfig.json`

Key settings:
- Target: ES2017
- Module: ESNext with bundler resolution
- Strict mode enabled
- Next.js plugin for framework integration
- Path aliases for clean imports

### Drizzle Configuration

**File**: `drizzle.config.ts`

```typescript
export default defineConfig({
  out: './src/lib/db/migrations',
  schema: './src/lib/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Next.js Configuration

**File**: `next.config.ts`

Currently minimal (default configuration):
```typescript
const nextConfig: NextConfig = {
  /* config options here */
};
```

### NPM Scripts

**File**: `package.json`

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --turbopack` | Start dev server with Turbopack |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `next lint` | Run ESLint |
| `clean` | `rm -rf .next node_modules` | Clean build artifacts |
| `db:generate` | `drizzle-kit generate` | Generate migrations |
| `db:migrate` | `drizzle-kit migrate` | Run migrations |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio GUI |
| `db:seed` | `tsx src/lib/db/seed.ts` | Seed database |
| `db:reset` | `tsx src/lib/db/reset.ts` | Reset database |

---

## Code References

### Core Configuration Files
- `package.json:1-66` - Project dependencies and scripts
- `tsconfig.json:1-44` - TypeScript configuration
- `drizzle.config.ts:1-11` - Drizzle ORM configuration
- `components.json:1-20` - shadcn/ui configuration

### Database Layer
- `src/lib/db/schema.ts:1-223` - Complete database schema
- `src/lib/db/index.ts:1-6` - Database client initialization
- `src/lib/db/seed.ts:1-166` - Seeding logic
- `src/lib/db/reset.ts:1-135` - Reset logic with migrations

### tRPC Layer
- `src/lib/trpc/context.ts:1-51` - tRPC initialization and context
- `src/lib/trpc/router/_app.ts:1-8` - Root router
- `src/lib/trpc/router/user.ts:1-37` - User procedures
- `src/lib/trpc/react.tsx:1-70` - Client provider
- `src/lib/trpc/server.tsx:1-49` - Server utilities

### Frontend Layer
- `src/app/layout.tsx:1-34` - Root layout
- `src/app/page.tsx:1-35` - Home page
- `src/app/_components/providers.tsx:1-19` - Provider composition
- `src/app/_components/user/user-list.tsx:1-59` - User list component
- `src/app/globals.css:1-122` - Global styles with theme variables

### API Layer
- `src/app/api/trpc/[trpc]/route.ts:1-39` - tRPC route handler

---

## Architecture Documentation

### Design Patterns

1. **Monorepo-Ready Structure**: Clean separation between lib, components, and app directories
2. **Type-Safe End-to-End**: tRPC ensures types flow from database schema to frontend
3. **Server Components First**: Default to server components, opt-in to client
4. **Prefetch on Server**: Queries prefetched in server components, hydrated to client
5. **Singleton Query Client**: Single QueryClient instance per browser session

### Data Flow

```
Database (SQLite)
       ↓
Drizzle ORM (src/lib/db/)
       ↓
tRPC Router (src/lib/trpc/router/)
       ↓
    ┌──────────────────┐
    │                  │
Server Components   Client Components
(prefetch/trpc)     (useTRPC/useSuspenseQuery)
    │                  │
    └──────────────────┘
              ↓
        React Query
              ↓
         UI Render
```

---

## Open Questions

1. **Authentication**: No authentication system is currently implemented. The schema has users but no auth-related fields (password hash, OAuth, etc.).

2. **Golf Feature UI**: The comprehensive golf schema (rounds, stats, clubs) is fully implemented in the database but not yet exposed in the UI beyond basic user management.

3. **API Completeness**: Only `userRouter` is implemented. The golf-specific entities (clubs, rounds, stats) do not have tRPC routers yet.

4. **Data Source**: The `data.json` file (74KB) appears to contain real golf data for seeding. Its origin and whether it represents production data structure is unclear.

5. **Deployment Target**: The presence of Vercel URL detection suggests potential Vercel deployment, but no deployment configuration files exist.
