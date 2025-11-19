This is a [Next.js](https://nextjs.org) MVP Starter Kit using [tRPC](https://trpc.io/), [Drizzle](https://orm.drizzle.team/) + SQLite, and [Shadcn UI](https://ui.shadcn.com/).

## Getting Started

First, install packages:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Set Environment Variables:

`cp .env.example .env`

Next, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Generate and Migrate to Local SQLite Database

`pnpm db:generate && pnpm db:migrate`

Seed and View Database

`pnpm db:seed && pnpm db:studio`
